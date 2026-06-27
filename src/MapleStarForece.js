import React, { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import "./MapleStarForece.css";

function getItemEventStatus(records) {
  let hasDiscount30 = false;
  let hasDestroyReduce = false;

  for (const record of records) {
    if (record.starforce_event_list && Array.isArray(record.starforce_event_list)) {
      for (const event of record.starforce_event_list) {
        if (event.cost_discount_rate === "30") hasDiscount30 = true;
        if (event.destroy_decrease_rate != null && event.destroy_decrease_rate !== "")
          hasDestroyReduce = true;
        if (hasDiscount30 && hasDestroyReduce) break;
      }
    }
    if (hasDiscount30 && hasDestroyReduce) break;
  }

  if (hasDiscount30 && hasDestroyReduce) return "샤타포스 진행중";
  if (hasDiscount30) return "30프로 비용할인중";
  if (hasDestroyReduce) return "파괴확률 감소중";
  
  // 3가지 모두 해당되지 않으면 여기서 반환
  return "이벤트 없음";
}
// 강화 전이 그룹핑 및 확률 계산 (기존 로직 유지)
function groupByItemAndTransitionFailMerged(data) {
  const groupedItems = {};
  const globalMaxStar = data.reduce(
    (max, item) => Math.max(max, item.after_starforce_count),
    0
  );

  data.forEach((item) => {
    const itemName = item.target_item || "이름 없음";
    if (!groupedItems[itemName]) {
      groupedItems[itemName] = {
        itemName,
        totalAttempts: 0,
        maxStar: 0,
        transitions: {},
        records: [],
      };
    }
    const group = groupedItems[itemName];
    group.totalAttempts++;
    group.records.push(item);

    if (item.after_starforce_count > group.maxStar) {
      group.maxStar = item.after_starforce_count;
    }

    const fromStar = item.before_starforce_count;
    const actualToStar = item.after_starforce_count;
    let toStar = actualToStar;

    if (fromStar === actualToStar) {
      const nextStar = fromStar + 1;
      toStar = nextStar <= globalMaxStar ? nextStar : actualToStar;
    }

    if (!group.transitions[fromStar]) group.transitions[fromStar] = {};
    if (!group.transitions[fromStar][toStar]) {
      group.transitions[fromStar][toStar] = { attempts: 0, success: 0, failure: 0, destroy: 0 };
    }

    const stat = group.transitions[fromStar][toStar];
    stat.attempts++;

    if (item.item_upgrade_result.includes("성공")) stat.success++;
    else if (item.item_upgrade_result.includes("파괴")) stat.destroy++;
    else if (item.item_upgrade_result.includes("실패") || fromStar === actualToStar) stat.failure++;
  });

  Object.values(groupedItems).forEach((group) => {
    Object.values(group.transitions).forEach((toObj) => {
      Object.values(toObj).forEach((stat) => {
        if (stat.attempts > 0) {
          stat.successRate = ((stat.success / stat.attempts) * 100).toFixed(1);
          stat.failureRate = ((stat.failure / stat.attempts) * 100).toFixed(1);
          stat.destroyRate = ((stat.destroy / stat.attempts) * 100).toFixed(1);
        } else {
          stat.successRate = stat.failureRate = stat.destroyRate = "0.0";
        }
      });
    });
  });

  return groupedItems;
}

// 전체 아이템 강화 전이 통계 누적 계산
function computeOverallTransitions(groupedItems) {
  const overall = {};
  Object.values(groupedItems).forEach((group) => {
    Object.entries(group.transitions).forEach(([fromStar, toObj]) => {
      if (!overall[fromStar]) overall[fromStar] = {};
      Object.entries(toObj).forEach(([toStar, stat]) => {
        if (!overall[fromStar][toStar]) overall[fromStar][toStar] = { attempts: 0, success: 0, failure: 0, destroy: 0 };
        const total = overall[fromStar][toStar];
        total.attempts += stat.attempts;
        total.success += stat.success;
        total.failure += stat.failure;
        total.destroy += stat.destroy;
      });
    });
  });

  Object.values(overall).forEach(toObj => {
    Object.values(toObj).forEach(stat => {
      if (stat.attempts > 0) {
        stat.successRate = ((stat.success / stat.attempts) * 100).toFixed(1);
        stat.failureRate = ((stat.failure / stat.attempts) * 100).toFixed(1);
        stat.destroyRate = ((stat.destroy / stat.attempts) * 100).toFixed(1);
      } else {
        stat.successRate = stat.failureRate = stat.destroyRate = "0.0";
      }
    });
  });

  return overall;
}

export default function MapleStarForece() {
  const apiKey = useSelector(state => state.apiKey);
  const [selectedDate, setSelectedDate] = useState("");
  const [starforceData, setStarforceData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState("전체보기");

  const onDateChange = async e => {
    const date = e.target.value;
    setSelectedDate(date);
    setError(null);
    setStarforceData(null);
    setSelectedItem("전체보기");

    if(!apiKey){
      setError("API 키가 없습니다!");
      return;
    }
    if(!date){
      setError("날짜를 선택해주세요.");
      return;
    }

    try{
      const res = await axios.get("http://localhost:8000/force",{
        params: { apiKey, date, count: 1000, cursor: "" }
      });
      setStarforceData(res.data.data);
    }catch(err){
      setError("서버 요청 실패: " + (err.message || "알 수 없는 오류"));
    }
  };

  const groupedItems = useMemo(() => {
    if(!starforceData?.starforce_history) return {};
    return groupByItemAndTransitionFailMerged(starforceData.starforce_history);
  }, [starforceData]);

  const overallStats = useMemo(() => {
    if(!groupedItems) return {};
    return computeOverallTransitions(groupedItems);
  }, [groupedItems]);

  const itemOptions = useMemo(() => ["전체보기", ...Object.keys(groupedItems)], [groupedItems]);

  const displayItems = useMemo(() => {
    if (selectedItem === "전체보기") return Object.values(groupedItems);
    return groupedItems[selectedItem] ? [groupedItems[selectedItem]] : [];
  }, [selectedItem, groupedItems]);

  // 아이템별 이벤트 상태 계산
  const itemEventStatuses = useMemo(() => {
    const map = {};
    Object.values(groupedItems).forEach(group => {
      map[group.itemName] = getItemEventStatus(group.records);
    });
    return map;
  }, [groupedItems]);

    const [mvpCategory, setMvpCategory] = useState('');
  const [pcBangDiscount, setPcBangDiscount] = useState('');
  const [destroyPrevention, setDestroyPrevention] = useState('');

  // 선택지 배열
  const mvpOptions = ['없음', '실버', '골드'];
  const pcBangOptions = ['있음', '없음'];
  const destroyPreventionOptions = ['15', '16', '17', '없음'];


  // 아이템 레벨과 노작값 상태 (한번만 받음)
  const [itemLevel, setItemLevel] = useState('');
  const [noMakeValue, setNoMakeValue] = useState('');
    const [itemDetails, setItemDetails] = useState({});

    const level160Data = {
  "15→16": {
    successRate: "30%",
    failureRate: "67.9%",
    destroyRate: "2.1%",
    baseCost: 36514500,
    totalCost: "6억 1392만 9489",
    avgAttempts: 0.07000,
    noDestroySuccessRate: "93.4579%"
  },
  "16→17": {
    successRate: "30%",
    failureRate: "67.9%",
    destroyRate: "2.1%",
    baseCost: 43008300,
    totalCost: "8억 9141만 3446",
    avgAttempts: 0.14490,
    noDestroySuccessRate: "87.3439%"
  },
  "17→18": {
    successRate: "15%",
    failureRate: "78.2%",
    destroyRate: "6.8%",
    baseCost: 66913100,
    totalCost: "23억 3189만 9323",
    avgAttempts: 0.66392,
    noDestroySuccessRate: "60.0990%"
  },
  "18→19": {
    successRate: "15%",
    failureRate: "78.2%",
    destroyRate: "6.8%",
    baseCost: 165920200,
    totalCost: "50억 8545만 2798",
    avgAttempts: 1.41823,
    noDestroySuccessRate: "41.3525%"
  },
  "19→20": {
    successRate: "15%",
    failureRate: "76.5%",
    destroyRate: "8.5%",
    baseCost: 296435300,
    totalCost: "106억 8130만 8612",
    avgAttempts: 2.78856,
    noDestroySuccessRate: "26.3952%"
  },
  "20→21": {
    successRate: "30%",
    failureRate: "59.5%",
    destroyRate: "10.5%",
    baseCost: 76090000,
    totalCost: "151억 2913만 9423",
    avgAttempts: 4.11456,
    noDestroySuccessRate: "19.5520%"
  },
  "21→22": {
    successRate: "15%",
    failureRate: "72.25%",
    destroyRate: "12.75%",
    baseCost: 138036600,
    totalCost: "300억 1594만 7774",
    avgAttempts: 8.46194,
    noDestroySuccessRate: "10.5687%"
  },
  "22→23": {
    successRate: "15%",
    failureRate: "68%",
    destroyRate: "17%",
    baseCost: 97274600,
    totalCost: "661억 5824만 7040",
    avgAttempts: 19.1855,
    noDestroySuccessRate: "4.95406%"
  },
  "23→24": {
    successRate: "10%",
    failureRate: "72%",
    destroyRate: "18%",
    baseCost: 109120000,
    totalCost: "1886억 7809만 4669",
    avgAttempts: 55.5193,
    noDestroySuccessRate: "1.76931%"
  },
  "24→25": {
    successRate: "10%",
    failureRate: "72%",
    destroyRate: "18%",
    baseCost: 121834900,
    totalCost: "5318억 6081만 7030",
    avgAttempts: 157.254,
    noDestroySuccessRate: "0.63190%"
  },
  "25→26": {
    successRate: "10%",
    failureRate: "72%",
    destroyRate: "18%",
    baseCost: 135444400,
    totalCost: "1조 4929억 853만 4643",
    avgAttempts: 442.111,
    noDestroySuccessRate: "0.22568%"
  },
  "26→27": {
    successRate: "7%",
    failureRate: "74.4%",
    destroyRate: "18.6%",
    baseCost: 149973700,
    totalCost: "5조 4653억 8216만 4869",
    avgAttempts: 1619.52,
    noDestroySuccessRate: "0.06171%"
  },
  "27→28": {
    successRate: "5%",
    failureRate: "76%",
    destroyRate: "19%",
    baseCost: 165447100,
    totalCost: "26조 2420억 9136만 1836",
    avgAttempts: 7777.5,
    noDestroySuccessRate: "0.01286%"
  },
  "28→29": {
    successRate: "3%",
    failureRate: "77.6%",
    destroyRate: "19.4%",
    baseCost: 181889200,
    totalCost: "195조 9554억 3213만 7524",
    avgAttempts: 58078.5,
    noDestroySuccessRate: "0.00172%"
  },
  "29→30": {
    successRate: "1%",
    failureRate: "79.2%",
    destroyRate: "19.8%",
    baseCost: 199324000,
    totalCost: "4075조 9187억 269만 3036",
    avgAttempts: 1208052,
    noDestroySuccessRate: "0.00008%"
  }
};
const handleSave = (itemName) => {
  const group = displayItems.find((g) => g.itemName === itemName);
  if (!group) {
    console.warn("해당 아이템 데이터를 찾을 수 없습니다:", itemName);
    return;
  }

  console.log("저장 버튼 눌린 아이템:", itemName);
  console.log("파괴방지:", destroyPrevention);
  console.log("아이템 레벨:", itemLevel);
  console.log("현재 선택 상태:");
  console.log("MVP 할인 카테고리:", mvpCategory);
  console.log("PC방 할인:", pcBangDiscount);
  console.log("노작값:", noMakeValue);

  const destroyPreventionNum = Number(destroyPrevention);

  // 수정된 파괴방지 구간 배열 생성 (17일 때 18→19 제외)
  const weightedSections = (() => {
    switch (destroyPreventionNum) {
      case 15:
        return [15,];
      case 16:
        return [15, 16,];
      case 17:
        return [15, 16, 16, 17,]; // 여기까지만 포함, 18→19 제외
      default:
        return [];
    }
  })();

  if (itemLevel === "160") {
    console.log(`== 레벨 ${itemLevel} 구간별 시도횟수 × 베이스 비용 (파괴방지 가중치 적용) ==`);

    let totalWeightedCost = 0;

    const formatKoreanUnit = (number) => {
      if (number === 0) return "0원";
      const units = [
        { value: 1e12, str: "조" },
        { value: 1e8, str: "억" },
        { value: 1e4, str: "만" },
        { value: 1e3, str: "천" },
      ];
      let result = "";
      let remainder = number;
      units.forEach(({ value, str }) => {
        const count = Math.floor(remainder / value);
        if (count > 0) {
          result += `${count}${str} `;
          remainder -= count * value;
        }
      });
      if (remainder > 0) result += `${remainder.toLocaleString()}원`;
      else result = result.trim() + "원";
      return result.trim();
    };

    Object.entries(group.transitions).forEach(([fromStar, toObj]) => {
      Object.entries(toObj).forEach(([toStar, stat]) => {
        const sectionKey = `${fromStar}→${toStar}`;
        const baseCost = level160Data[sectionKey]?.baseCost;

        if (baseCost === undefined) {
          console.warn(`level160Data에 '${sectionKey}' 구간에 대한 데이터가 없습니다.`);
          return;
        }

        const attempts = stat.attempts || 0;
        const fromNum = parseInt(fromStar, 10);

        const isWeighted = weightedSections.includes(fromNum);

        const cost = isWeighted
          ? baseCost * attempts * 3
          : baseCost * attempts;

        if (isWeighted) totalWeightedCost += cost;

        console.log(
          `${sectionKey} : 시도횟수 = ${attempts}회, 베이스 비용 = ${formatKoreanUnit(
            baseCost
          )}, 총 비용 = ${formatKoreanUnit(cost)}${isWeighted ? "  ※ 파괴방지 구간 가중치 적용" : ""}`
        );
      });
    });

    if (weightedSections.length && totalWeightedCost > 0) {
      console.log(`\n▶ 파괴방지 가중치 적용된 총 비용 합계: ${formatKoreanUnit(totalWeightedCost)}`);
    } else {
      console.log("\n▶ 파괴방지 구간에 가중치가 적용된 비용이 없습니다.");
    }
  } else {
    console.log(`레벨 ${itemLevel} 데이터는 아직 준비되지 않았습니다.`);
  }

  // 기존 강화 구간별 시도횟수 출력
  const attemptsSummary = [];
  Object.entries(group.transitions).forEach(([fromStar, toObj]) => {
    Object.entries(toObj).forEach(([toStar, stat]) => {
      attemptsSummary.push({
        section: `${fromStar}성 → ${toStar}성`,
        attempts: stat.attempts || 0,
      });
    });
  });

  console.log(`=== [${itemName}] 강화 구간별 총 시도횟수 ===`);
  attemptsSummary.forEach(({ section, attempts }) => {
    console.log(`${section}: ${attempts}회`);
  });
};

  const formatMoneyUnit = (numStr) => {
    if (!numStr) return '';

    const num = parseInt(numStr, 10);
    if (isNaN(num) || num <= 0) return '';

    const units = [
      '1원 메소', '10원 메소', '100원 메소', '1000원 메소',
      '1만원 메소', '10만 메소', '100만 메소',
      '천만 메소', '억 메소', '10억 메소', '100억 메소','1000억 메소',
      '1조 메소', '10조 메소', '100조 메소',
      '1경 메소', '10경 메소', '100경 메소', '해 메소'
    ];

    const length = numStr.length;
    const index = Math.min(length - 1, units.length - 1);
    return units[index];
  };

const isSaveDisabled = !(
  mvpCategory &&
  pcBangDiscount &&
  destroyPrevention &&
  itemLevel &&
  noMakeValue
);

  return (
<div style={{ maxWidth: 1600, margin: "0 auto", padding: 20, display: "block" }}>
  {/* apiKey가 있을 때 날짜 입력 UI 보여줌 */}
  {apiKey && (
    <label>
      날짜 선택:{" "}
      <input 
        type="date" 
        value={selectedDate} 
        onChange={onDateChange} 
      />
    </label>
  )}

  {error && <p style={{ color: "red" }}>{error}</p>}

  {/* starforceData가 있을 때만 데이터 관련 UI 보여줌 */}
  {starforceData && starforceData.starforce_history?.length > 0 && (
    <>
      <label style={{ marginTop: 15,}}>
        아이템 선택:{" "}
        <select 
          value={selectedItem} 
          onChange={e => setSelectedItem(e.target.value)}
        >
          {itemOptions.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </label>

      {displayItems.length === 0 ? (
        <p>선택한 아이템의 데이터가 없습니다.</p>
      ) : (
        displayItems.map(group => (
          
          <div key={group.itemName} className="starforce-list">
            <div className="starforce-card" style={{ marginTop: 20 }}>

<div className="item-info-form">
  <h3>아이템 기본 정보 입력</h3>
        <h3>할인 및 파괴방지 선택</h3>

      {/* MVP 할인 카테고리 */}
      <div style={{ marginBottom: 15 }}>
        <label htmlFor="mvpCategory" style={{ display: 'block', marginBottom: 6, fontWeight: '600' }}>
          MVP 할인 카테고리
        </label>
        <select
          id="mvpCategory"
          value={mvpCategory}
          onChange={e => setMvpCategory(e.target.value)}
          style={{ width: '100%', padding: 8, fontSize: 16, borderRadius: 6, border: '1.5px solid #ccc' }}
        >
          <option value="" disabled>선택하세요</option>
          {mvpOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {/* PC방 할인 */}
      <div style={{ marginBottom: 15 }}>
        <label htmlFor="pcBangDiscount" style={{ display: 'block', marginBottom: 6, fontWeight: '600' }}>
          PC방 할인
        </label>
        <select
          id="pcBangDiscount"
          value={pcBangDiscount}
          onChange={e => setPcBangDiscount(e.target.value)}
          style={{ width: '100%', padding: 8, fontSize: 16, borderRadius: 6, border: '1.5px solid #ccc' }}
        >
          <option value="" disabled>선택하세요</option>
          {pcBangOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {/* 파괴방지 */}
      <div style={{ marginBottom: 15 }}>
        <label htmlFor="destroyPrevention" style={{ display: 'block', marginBottom: 6, fontWeight: '600' }}>
          파괴방지
        </label>
        <select
          id="destroyPrevention"
          value={destroyPrevention}
          onChange={e => setDestroyPrevention(e.target.value)}
          style={{ width: '100%', padding: 8, fontSize: 16, borderRadius: 6, border: '1.5px solid #ccc' }}
        >
          <option value="" disabled>선택하세요</option>
          {destroyPreventionOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
  <div className="input-group">
    <label htmlFor="itemLevel">아이템 레벨:</label>
    <select
      id="itemLevel"
      value={itemLevel}
      onChange={(e) => setItemLevel(e.target.value)}
      className="styled-select"
    >
      <option value="" disabled>레벨 선택</option>
      {[140, 150, 160, 200, 250].map(level => (
        <option key={level} value={level}>{level}</option>
      ))}
    </select>
  </div>
  <div className="input-group">
    <label htmlFor="noMakeValue">노작값:</label>
    <div className="input-with-unit">
      <input
        id="noMakeValue"
        type="number"
        min="0"
        value={noMakeValue}
        onChange={e => setNoMakeValue(e.target.value.replace(/^0+/, ''))}
        placeholder="노작값을 입력하세요"
        className="styled-input"
        autoComplete="off"
        spellCheck="false"
      />
      <div className="mesocheck">{formatMoneyUnit(noMakeValue)}</div>
    </div>
  </div>
  <button
  className="save-button"
  type="button"
  disabled={isSaveDisabled}
  onClick={() => handleSave(group.itemName)}
>
  저장
</button>
</div>
              <h2>{group.itemName} 강화 전이 통계</h2>
              <p>총 강화 시도: {group.totalAttempts}회 / 최대 강화 등급: {group.maxStar}성</p>

              <TransitionTable transitions={group.transitions} />

              {itemEventStatuses[group.itemName] && (
                <div className={`event-message ${itemEventStatuses[group.itemName] === "샤타포스 진행중" ? "text-glow" : ""}`}>
                  {itemEventStatuses[group.itemName]}
                </div>
              )}

              <details style={{ marginTop: 20 }}>
                <summary>상세 강화 내역 보기</summary>
                <ul style={{ maxHeight: 200, overflowY: "auto", marginTop:10, paddingLeft: 20 }}>
                  {group.records.map(record => (
                    <li key={record.id}>
                      {record.character_name} ({record.world_name}) — 강화 전: {record.before_starforce_count}성, 강화 후: {record.after_starforce_count}성, 결과: {record.item_upgrade_result}, 날짜: {new Date(record.date_create).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        ))
      )}

      <div style={{ marginTop: 40 }}>
        <h2>전체 아이템 강화 전이 통합 확률표</h2>
        <TransitionTable transitions={overallStats} />
      </div>
    </>
  )}

  {/* API 키가 있고, 날짜는 선택됐지만 데이터 없으면 메시지 */}
  {selectedDate && starforceData && starforceData.starforce_history.length === 0 && !error && (
    <p>해당 날짜에 스타포스 기록이 없습니다.</p>
  )}
</div>
  )
}
const avgValuesByRange = {
  "0-1":   { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "1-2":   { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "2-3":   { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "3-4":   { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "4-5":   { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "5-6":   { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "6-7":   { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "7-8":   { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "8-9":   { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "9-10":  { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "10-11": { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "11-12": { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "12-13": { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "13-14": { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "14-15": { successAvg: "8.5%",  failureAvg: "88.5%", destroyAvg: "3.0%",  noDestroySuccessRate: "8.74%"  },
  "15-16": { successAvg: "31.5%", failureAvg: "63.061%", destroyAvg: "1.439%", noDestroySuccessRate: "95.633%" },
  "16-17": { successAvg: "31.5%", failureAvg: "63.061%", destroyAvg: "1.439%", noDestroySuccessRate: "95.633%" },
  "17-18": { successAvg: "15.75%", failureAvg: "79.532%", destroyAvg: "4.718%", noDestroySuccessRate: "76.949%" },
  "18-19": { successAvg: "15.75%", failureAvg: "79.532%", destroyAvg: "4.718%", noDestroySuccessRate: "76.949%" },
  "19-20": { successAvg: "15.75%", failureAvg: "78.352%", destroyAvg: "5.898%", noDestroySuccessRate: "72.757%" },
  "20-21": { successAvg: "31.5%", failureAvg: "61.307%", destroyAvg: "7.193%", noDestroySuccessRate: "81.411%" },
  "21-22": { successAvg: "15.75%", failureAvg: "75.19%",  destroyAvg: "8.846%", noDestroySuccessRate: "64.034%" },
  "22-23": { successAvg: "15.75%", failureAvg: "67.4%",  destroyAvg: "16.85%", noDestroySuccessRate: "48.313%" }  
};
// 2. 이벤트 상태에 따른 객체 선택 (예시)
const eventStatus = "샤타포스 진행중"; // 또는 다른 상태
const avgValuesObjectByEvent = {
  "샤타포스 진행중": avgValuesByRange,
  "이벤트 없음": {
    "20-21": { successAvg: 7.0, failureAvg: 7.0, destroyAvg: 6.0 },
    "21-22": { successAvg: 6.5, failureAvg: 7.5, destroyAvg: 6.0 },
    // ...
  },
};


const currentAvgValues = avgValuesObjectByEvent[eventStatus] || avgValuesByRange;

// 3. TransitionTable 컴포넌트 예시 (일부 수정)

function TransitionTable({ transitions, eventStatus }) {
  const avgValuesMap = avgValuesObjectByEvent[eventStatus] || avgValuesByRange;
  
  // 문자열 % 제거 후 숫자 변환
  const parsePercent = (str) => {
    if (!str || str === "-") return null;
    const n = parseFloat(str.toString().replace('%', '').trim());
    return isNaN(n) ? null : n;
  };

  // 나만의 파없성 확률 계산 함수
  function calculateMyNoDestroySuccessRate(transitions) {
    const result = {};
    for (const [fromStar, toObj] of Object.entries(transitions)) {
      for (const [toStar, stat] of Object.entries(toObj)) {
        const key = `${fromStar}-${toStar}`;
        const successRate = parsePercent(stat.successRate);
        const destroyRate = parsePercent(stat.destroyRate);
        if (successRate === null || destroyRate === null) {
          result[key] = "-";
          continue;
        }
        const total = successRate + destroyRate;
        result[key] = total === 0 ? "100.00" : ((successRate / total) * 100).toFixed(2);
      }
    }
    return result;
  }

  const myNoDestroyRates = calculateMyNoDestroySuccessRate(transitions);

  // 성공/실패/파괴 비율 비교용 렌더 함수 (성공률: 플러스 빨강, 마이너스 파랑)
  const renderRateWithComparison = (currentStr, avgStr) => {
    if (!currentStr || !avgStr || currentStr === "-" || avgStr === "-") {
      return <span style={{ color: 'white' }}>{currentStr ?? "-"}</span>;
    }
    const currentVal = parsePercent(currentStr);
    const avgVal = parsePercent(avgStr);
    if (currentVal === null || avgVal === null) return <span style={{ color: 'white' }}>{currentStr}</span>;
    const diff = currentVal - avgVal;
    const color = diff > 0 ? "rgba(241, 112, 122, 0.7)" : diff < 0 ? "rgba(135, 206, 250, 0.7)" : "white";
    const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "";
    return (
      <span style={{ color, fontWeight: "bold", whiteSpace: "nowrap" }}>
        {currentVal.toFixed(2)}% <br />
        <small style={{ fontWeight: "normal" }}>{arrow} {diff === 0 ? "차이 없음" : Math.abs(diff).toFixed(2) + "%"}</small>
      </span>
    );
  };

  // 나만의 파없성 확률 비교용 렌더 함수 (평균과 비교, 색상·화살표 포함)
  const renderMyNoDestroyRateCell = (myStr, avgStr) => {
    if (!myStr || !avgStr || myStr === "-" || avgStr === "-") {
      return <span style={{ color: 'white' }}>{myStr ?? "-"}</span>;
    }
    const myVal = parsePercent(myStr);
    const avgVal = parsePercent(avgStr);
    if (myVal === null || avgVal === null) return <span style={{ color: 'white' }}>{myStr}</span>;
    const diff = myVal - avgVal;
    let color = "white";
    let arrow = "";
    if (diff > 5) color = "rgba(241, 112, 122, 0.7)";
    else if (diff > 0) color = "rgba(255, 182, 193, 0.7)";
    else if (diff < 0) color = "rgba(135, 206, 250, 0.7)";
    if (diff > 0) arrow = "▲";
    else if (diff < 0) arrow = "▼";
    return (
      <span style={{ color, fontWeight: "bold", whiteSpace: "nowrap" }}>
        {myVal.toFixed(2)}% <br />
        <small style={{ fontWeight: "normal" }}>{arrow} {diff === 0 ? "차이 없음" : Math.abs(diff).toFixed(2) + "%"}</small>
      </span>
    );
  };


  




  return (
    <div className="container">
      <div className="table-area">
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", marginTop: 10 }} border="1">
          <thead>
            <tr>
              <th>강화 전 등급</th><th>강화 후 등급</th><th>시도 횟수</th><th>나의성공 횟수</th><th>성공률 (%)</th><th>성공 평균값</th><th>나의실패 횟수</th><th>나의실패율 (%)</th><th>실패 평균값</th><th>나의파괴 횟수</th><th>파괴율 (%)</th><th>파괴 평균값</th><th>나만의 파없성 확률 (%)</th><th>파없성 평균</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(transitions).map(([fromStar, toObj]) =>
              Object.entries(toObj).map(([toStar, stat]) => {
                const key = `${fromStar}-${toStar}`;
                const avgVals = avgValuesMap[key] || {};
                const myRate = myNoDestroyRates[key] || "-";

                return (
                  <tr key={key}>
                    <td>{fromStar}성</td>
                    <td>{toStar}성</td>
                    <td>{stat.attempts}</td>
                    <td>{stat.success}</td>
                    <td>{renderRateWithComparison(stat.successRate, avgVals.successAvg)}</td>
                    <td>{avgVals.successAvg !== undefined ? `${avgVals.successAvg}` : "-"}</td>
                    <td>{stat.failure}</td>
                    <td>{renderRateWithComparison(stat.failureRate, avgVals.failureAvg)}</td>
                    <td>{avgVals.failureAvg !== undefined ? `${avgVals.failureAvg}` : "-"}</td>
                    <td>{stat.destroy}</td>
                    <td>{renderRateWithComparison(stat.destroyRate, avgVals.destroyAvg)}</td>
                    <td>{avgVals.destroyAvg !== undefined ? `${avgVals.destroyAvg}` : "-"}</td>
                       <td>{renderMyNoDestroyRateCell(myRate, avgVals.noDestroySuccessRate)}</td>
                    <td>{avgVals.noDestroySuccessRate !== undefined ? `${avgVals.noDestroySuccessRate}` : "-"}</td>
                 
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="chart-area"><p style={{ textAlign: "center", color: "#666" }}>[차트 영역]</p></div>
    </div>
  );
}