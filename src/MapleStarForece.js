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

  return (
<div style={{ maxWidth: 1600, margin: "0 auto", padding: 20 }}>
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
      <label style={{ marginTop: 15, display: "block" }}>
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
   // 저장 시 해당 아이템 키별 상태 전체 출력
  const handleSave = (key) => {
    const data = itemDetails[key];
    alert(`저장된 구간: ${key}\n데이터: ${JSON.stringify(data, null, 2)}`);
    console.log('저장 데이터:', key, data);
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



  return (
    <div className="container">
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
  <button onClick={handleSave} className="save-button" type="button">
    저장
  </button>
</div>
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