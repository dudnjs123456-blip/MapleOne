import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setApiKey } from './apiKeySlice';
import axios from 'axios';
import './MapleCharacterSlider.css';

const ITEMS_PER_PAGE = 6;
const CARD_WIDTH = 240;
const GAP = 30;

export default function MapleCharacterSlider() {
  const apiKey = useSelector(state => state.apiKey);
  const dispatch = useDispatch();

  const [basicChars, setBasicChars] = useState([]);
  const [detailsMap, setDetailsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (apiKey) {
      console.log('변경된 API 키:', apiKey);
    }
  }, [apiKey]);

  const fetchBasicCharacters = async () => {
    if (!apiKey.trim()) {
      setError('API 키를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    setBasicChars([]);
    setDetailsMap({});
    setCurrentPage(0);

    try {
      const res = await axios.post('http://localhost:8000/api/maple/character', { apiKey });
      if (res.data.success && res.data.data && res.data.data.account_list) {
        const allChars = res.data.data.account_list.flatMap(acc => acc.character_list || []);
        allChars.sort((a, b) => b.character_level - a.character_level);
        setBasicChars(allChars);
      } else {
        setError('캐릭터 목록을 불러올 수 없습니다.');
      }
    } catch {
      setError('서버 요청 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!apiKey || basicChars.length === 0) return;

    const fetchDetails = async () => {
      const start = currentPage * ITEMS_PER_PAGE;
      const visibleChars = basicChars.slice(start, start + ITEMS_PER_PAGE);

      const ocidList = visibleChars
        .map(c => c.ocid)
        .filter(ocid => ocid && !detailsMap[ocid]);

      if (ocidList.length === 0) return;

      setDetailLoading(true);
      try {
        const res = await axios.post('http://localhost:8000/api/maple/character/basic', { apiKey, ocidList });
        if (res.data.success) {
          setDetailsMap(prev => {
            const newMap = { ...prev };
            res.data.details.forEach(({ ocid, data }) => {
              newMap[ocid] = data;
            });
            return newMap;
          });
        }
      } catch {
        // 필요 시 에러 처리
      } finally {
        setDetailLoading(false);
      }
    };

    fetchDetails();
  }, [apiKey, basicChars, currentPage, detailsMap]);

  const totalPages = Math.max(1, Math.ceil(basicChars.length / ITEMS_PER_PAGE));
  const sliderWidth = ITEMS_PER_PAGE * CARD_WIDTH + (ITEMS_PER_PAGE - 1) * GAP;
  const currentChars = basicChars.slice(currentPage * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

  return (
    <div className="slider-container">
      <h2>메이플스토리 캐릭터 슬라이드</h2>

      <div className="input-area">
        <input
          type="text"
          placeholder="API 키 입력"
          value={apiKey}
          onChange={e => dispatch(setApiKey(e.target.value))}
          disabled={loading || detailLoading}
        />
        <button onClick={fetchBasicCharacters} disabled={loading || detailLoading}>
          {loading ? '불러오는 중...' : '캐릭터 불러오기'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="slider-wrapper" style={{ overflow: 'hidden', marginTop: 20 }}>
        <div
          className="slider"
          style={{
            display: 'flex',
            gap: `${GAP}px`,
            width: `${sliderWidth}px`,
            transform: `translateX(-${currentPage * (CARD_WIDTH + GAP)}px)`,
            transition: 'transform 0.5s ease',
          }}
        >
          {currentChars.map(char => {
            const detail = detailsMap[char.ocid];
            return (
              <div key={char.ocid} className="card">
                <img
                  src={detail?.character_image || '/placeholder.png'}
                  alt={char.character_name}
                  className="character-image"
                  loading="lazy"
                />
                <h3 className="character-name">{char.character_name}</h3>
                <p className="character-info">월드: {char.world_name}</p>
                <p className="character-info">직업: {char.character_class}</p>
                <p className="character-info">레벨: {char.character_level}</p>
                {detailLoading && !detail ? (
                  <p className="character-info">상세정보 로딩중...</p>
                ) : detail ? (
                  <>
                    <p className="character-info">경험치: {Number(detail.character_exp).toLocaleString()}</p>
                    <p className="character-info">길드: {detail.character_guild_name || '없음'}</p>
                    <p className="character-info">생성일: {new Date(detail.character_date_create).toLocaleDateString()}</p>
                  </>
                ) : (
                  <p className="character-info">상세정보 없음</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="nav-buttons" style={{ marginTop: 20, textAlign: 'center' }}>
        <button
          onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
          disabled={currentPage === 0 || loading || detailLoading}
          style={{ marginRight: 10 }}
        >
          이전
        </button>
        <span>{currentPage + 1} / {totalPages}</span>
        <button
          onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
          disabled={currentPage >= totalPages - 1 || loading || detailLoading}
          style={{ marginLeft: 10 }}
        >
          다음
        </button>
      </div>
    </div>
  );
}