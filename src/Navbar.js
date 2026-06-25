import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setUser, clearUser } from './userSlice';
import './Navbar.css';

function Navbar() {
  const dispatch = useDispatch();
  const usernameFromStore = useSelector((state) => state.user.username);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const navigate = useNavigate();

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    setLoginMessage('');
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setUsername('');
    setPassword('');
    setLoginMessage('');
  };

  const handleSignUpClick = () => {
    closeLoginModal();
    navigate('/signup');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setLoginMessage('로그인 성공! 터미널에 서버 로그 확인하세요.');
        dispatch(setUser({ username: data.username || username, token: data.token || null }));
        closeLoginModal();
      } else {
        setLoginMessage(data.message || '로그인 실패');
      }
    } catch (error) {
      setLoginMessage('서버 연결 실패');
      console.error(error);
    }
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    dispatch(clearUser());
    alert('로그아웃 되었습니다.');
    // 필요시 다른 페이지로 이동 또는 상태 초기화 추가
  };

  return (
    <>
      <header className="main-navbar">
        <div className="navbar-logo">
          <h1>MapleStory One</h1>
        </div>
        <nav className="navbar-menu">{/* 기존 메뉴 유지 */}</nav>
        <div className="navbar-auth">
          {usernameFromStore ? (
            <>
              <span>{usernameFromStore} 님, 환영합니다!</span>
              <button onClick={handleLogout} style={{ marginLeft: '10px' }}>로그아웃</button>
            </>
          ) : (
            <button onClick={openLoginModal}>로그인</button>
          )}
        </div>
      </header>

      {isLoginModalOpen && (
        <div className="login-modal-overlay" onClick={closeLoginModal}>
          <div className="login-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>로그인</h2>
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label htmlFor="username">아이디:</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">비밀번호:</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit">로그인</button>
              <button type="button" onClick={closeLoginModal}>닫기</button>
              <button type="button" className="signup-button" onClick={handleSignUpClick}>회원가입</button>
            </form>
            {loginMessage && <p className="login-message">{loginMessage}</p>}
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;