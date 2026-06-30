// src/Mainpage.js
import React, { useEffect, useState, useRef } from 'react';
import Navbar from './Navbar';
import MapleApiFetcher from './MapleApiFetcher';
import MapleStarForece from './MapleStarForece';
import './App.css';



function Mainpage() {
  const [searchTerm, setSearchTerm] = useState(''); // 검색어를 위한 상태
   
   const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const ws = useRef(null);

  

  useEffect(() => {
  ws.current = new WebSocket('ws://localhost:5000'); // 5000 포트로 수정


    ws.current.onopen = () => {
      console.log('웹소켓 연결됨');
    };

    ws.current.onmessage = (event) => {
      setMessages(prev => [...prev, event.data]);
    };

    ws.current.onclose = () => {
      console.log('웹소켓 연결 끊김');
    };

    ws.current.onerror = (error) => {
      console.error('웹소켓 에러:', error);
    };

    // 컴포넌트 언마운트시 웹소켓 종료하지 않고, 종료 버튼 클릭 시만 종료하도록 처리
    return () => {};
  }, []);


  
  const sendMessage = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && input.trim() !== '') {
      ws.current.send(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleClose = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  };


  // LCK 선수 데이터 (예시입니다! 실제 데이터는 더 풍부하게 넣을 수 있어요!)
  // Faker 선수의 이미지와 다른 선수들의 이미지도 placeholder로 일단 넣어두었어요!
  const lckPlayers = [
    { id: 1, name: 'Faker', team: 'T1', role: 'Mid', image: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=Faker', description: 'LCK의 살아있는 전설, 미드 라인의 지배자.' },
    { id: 2, name: 'Keria', team: 'T1', role: 'Support', image: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Keria', description: '창의적인 플레이로 팀을 승리로 이끄는 서포터.' },
    { id: 3, name: 'Oner', team: 'T1', role: 'Jungle', image: 'https://via.placeholder.com/150/00FFFF/000000?text=Oner', description: '공격적인 정글링과 뛰어난 판단력.' },
    { id: 4, name: 'Gumayusi', team: 'T1', role: 'ADC', image: 'https://via.placeholder.com/150/FFFF00/000000?text=Gumayusi', description: '강력한 캐리력을 가진 원거리 딜러.' },
    { id: 5, name: 'Zeus', team: 'T1', role: 'Top', image: 'https://via.placeholder.com/150/FF00FF/FFFFFF?text=Zeus', description: '뛰어난 피지컬과 넓은 챔피언 폭.' },

    { id: 6, name: 'Chovy', team: 'Gen.G', role: 'Mid', image: 'https://via.placeholder.com/150/00FF00/000000?text=Chovy', description: '압도적인 라인전과 캐리력을 자랑하는 미드 라이너.' },
    { id: 7, name: 'Peanut', team: 'Gen.G', role: 'Jungle', image: 'https://via.placeholder.com/150/00FFFF/000000?text=Peanut', description: '노련한 운영과 변수 창출.' },
    { id: 8, name: 'Peyz', team: 'Gen.G', role: 'ADC', image: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Peyz', description: '신인답지 않은 과감한 플레이.' },
    { id: 9, name: 'Doran', team: 'Gen.G', role: 'Top', image: 'https://via.placeholder.com/150/800080/FFFFFF?text=Doran', description: '단단한 라인전과 한타 기여도.' },
    { id: 10, name: 'Delight', team: 'Gen.G', role: 'Support', image: 'https://via.placeholder.com/150/FFA500/000000?text=Delight', description: '안정적인 포지셔닝과 센스있는 플레이.' },
    
    { id: 11, name: 'Cuzz', team: 'Kwangdong Freecs', role: 'Jungle', image: 'https://via.placeholder.com/150/A52A2A/FFFFFF?text=Cuzz', description: '공격적인 정글로 게임의 흐름을 주도.' },
    { id: 12, name: 'Taeyoon', team: 'Kwangdong Freecs', role: 'ADC', image: 'https://via.placeholder.com/150/808000/FFFFFF?text=Taeyoon', description: '잠재력 높은 신예 원거리 딜러.' },
    { id: 13, name: 'YoungJae', team: 'Kwangdong Freecs', role: 'Support', image: 'https://via.placeholder.com/150/000080/FFFFFF?text=YoungJae', description: '팀의 든든한 방패가 되는 서포터.' },
    
    // 더 많은 선수들을 추가해보세요!
    // 각 팀별로 선수 데이터를 묶어두는 것이 관리하기 편리해요.
  ];

  // 검색어에 따라 필터링된 선수 목록
  const filteredPlayers = lckPlayers.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 필터링된 선수들을 팀별로 그룹화
  const groupedPlayers = filteredPlayers.reduce((acc, player) => {
    if (!acc[player.team]) {
      acc[player.team] = [];
    }
    acc[player.team].push(player);
    return acc;
  }, {});

  // 팀 이름을 정렬 (예: T1, Gen.G 순서로)
  const sortedTeamNames = Object.keys(groupedPlayers).sort();


  return (
    <div className="App">
      <Navbar /> {/* Navbar는 그대로 유지됩니다 */}
        <img
        src="/메이린2.png"
        alt="예시 이미지"
        className="responsive-img 메이린2"
        style={{
          position: 'absolute',
          bottom: '450px',      // 화면 아래 10px
          right: '1580px',       // 오른쪽 10px
          width: '300px',      // 크기 작게
          opacity: 1,        // 약간 투명하게
          zIndex: 0,           // 다른 요소보다 뒤에 배치
          pointerEvents: 'none' // 클릭 방지 (필요에 따라)
        }}
      />
      <img src="/메이린.gif" alt="애니메이션 gif"   className="responsive-img 메이린-gif"
              style={{
          position: 'absolute',
          bottom: '-350px',      // 화면 아래 10px
          right: '0px',       // 오른쪽 10px
          width: '300px',      // 크기 작게
          opacity: 1,        // 약간 투명하게
          zIndex: 0,           // 다른 요소보다 뒤에 배치
          pointerEvents: 'none' // 클릭 방지 (필요에 따라)
        }}
      />

        <img src="/레테.webp" alt="애니메이션 gif"   className="responsive-img 레테"
              style={{
          position: 'absolute',
          bottom: '50px',      // 화면 아래 10px
          right: '0px',       // 오른쪽 10px
          width: '400px',      // 크기 작게
          opacity: 1,        // 약간 투명하게
          zIndex: 0,           // 다른 요소보다 뒤에 배치
          pointerEvents: 'none' // 클릭 방지 (필요에 따라)
        }}
      />
      
      <MapleApiFetcher></MapleApiFetcher>
      <MapleStarForece></MapleStarForece>
      <main className="lck-main-content">
        <section id="lck-players-section" className="lck-players-container">
          <h2>🌟 LCK 스타 플레이어즈 🌟</h2>

        <div>
<input
              type="text"
              placeholder="메시지를 입력하세요"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
            />
      <button onClick={sendMessage} disabled={input.trim() === ''}>
        전송
      </button>
      <button onClick={handleClose} disabled={!ws.current}>
        종료
      </button>
        <ul>
              {messages.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
    </div>


          <p className="section-description">롤(LoL) 프로 리그 LCK의 빛나는 선수들을 팀별로 만나보세요!</p>

          <div className="search-bar">
            <input
              type="text"
              placeholder="선수 이름, 팀, 포지션으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {Object.keys(groupedPlayers).length > 0 ? (
            <div className="team-list-wrapper">
              {sortedTeamNames.map(teamName => (
                <div key={teamName} className="team-section">
                  <h3 className="team-title">{teamName}</h3>
                  <div className="team-player-list">
                    {groupedPlayers[teamName].map((player) => (
                      <div key={player.id} className="player-card">
                        <img src={player.image} alt={player.name} className="player-image" />
                        <div className="player-info">
                          <h4 className="player-name">{player.name}</h4> {/* 선수 이름 h4로 변경 */}
                          <p className="player-role">포지션: {player.role}</p>
                          <p className="player-description">{player.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-results">"${searchTerm}"에 해당하는 선수를 찾을 수 없어요. 다른 검색어를 입력해보세요!</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default Mainpage;