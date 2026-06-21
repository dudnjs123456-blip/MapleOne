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
    <div style={{maxWidth: 900, margin: "0 auto", padding: 20}}>
      <label>
        날짜 선택:{" "}
        <input type="date" value={selectedDate} onChange={onDateChange} />
      </label>

      {error && <p style={{color: "red"}}>{error}</p>}

      {starforceData && starforceData.starforce_history?.length > 0 && (
        <>
          <label style={{marginTop: 15, display:"block"}}>
            아이템 선택:{" "}
            <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
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
                <div className="starforce-card" style={{marginTop: 20}}>
                  <h2>{group.itemName} 강화 전이 통계</h2>
                  <p>총 강화 시도: {group.totalAttempts}회 / 최대 강화 등급: {group.maxStar}성</p>
                  
                  <TransitionTable transitions={group.transitions} />

                  {/* 이벤트 상태 표시 */}
                  {itemEventStatuses[group.itemName] && (
                    <div className={`event-message ${itemEventStatuses[group.itemName] === "샤타포스 진행중" ? "text-glow" : ""}`}>
                      {itemEventStatuses[group.itemName]}
                    </div>
                  )}

                  <details style={{marginTop: 20}}>
                    <summary>상세 강화 내역 보기</summary>
                    <ul style={{maxHeight: 200, overflowY: "auto", marginTop: 10, paddingLeft: 20}}>
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

          <div style={{marginTop: 40}}>
            <h2>전체 아이템 강화 전이 통합 확률표</h2>
            <TransitionTable transitions={overallStats} />
          </div>
        </>
      )}

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

  return (
    <div className="container">
      <div className="table-area">
        <table border="1" style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", marginTop: 10 }}>
          <thead>
            <tr>
              {/* 기존 헤더 내용 */}
              <th>강화 전 등급</th>
              <th>강화 후 등급</th>
              <th>시도 횟수</th>
              <th>성공 횟수</th>
              <th>성공률 (%)</th>
              <th>성공 평균값</th>
              <th>실패 횟수</th>
              <th>실패율 (%)</th>
              <th>실패 평균값</th>
              <th>파괴 횟수</th>
              <th>파괴율 (%)</th>
              <th>파괴 평균값</th>
              {/* 새로 추가된 수기 입력값 칸 */}
              <th>파없성 평균</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(transitions).map(([fromStar, toObj]) =>
              Object.entries(toObj).map(([toStar, stat]) => {
                const key = `${fromStar}-${toStar}`;
                const avgVals = avgValuesMap[key] || {
                  successAvg: "-", failureAvg: "-", destroyAvg: "-", manualInput: ""
                };
                return (
                  <tr key={key}>
                    <td>{fromStar}성</td>
                    <td>{toStar}성</td>
                    <td>{stat.attempts}</td>
                    <td>{stat.success}</td>
                    <td>{stat.successRate}</td>
                    <td>{avgVals.successAvg}</td>
                    <td>{stat.failure}</td>
                    <td>{stat.failureRate}</td>
                    <td>{avgVals.failureAvg}</td>
                    <td>{stat.destroy}</td>
                    <td>{stat.destroyRate}</td>
                    <td>{avgVals.destroyAvg}</td>
                    <td>{avgVals.noDestroySuccessRate}</td> {/* 수기값 표시 */}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="chart-area">
        <p style={{ textAlign: "center", color: "#666" }}>[차트 영역]</p>
      </div>
    </div>
  );
}