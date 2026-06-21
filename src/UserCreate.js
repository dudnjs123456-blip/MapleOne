import React, { useState, useEffect } from 'react';
import './UserCreate.css';

function UserCreate() {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [userList, setUserList] = useState([]);
  const [message, setMessage] = useState('');

  // IP 주소 가져오기 (비동기)
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => setIpAddress('알 수 없음'));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 아이디 검증: 영문자+숫자만, 4글자 이상
    const idRegex = /^[A-Za-z0-9]+$/;
    if (!idRegex.test(newUsername)) {
      alert('아이디는 영어와 숫자만 사용 가능합니다.');
      return;
    }
    if (newUsername.trim().length < 4) {
      alert('아이디는 최소 4글자 이상이어야 합니다.');
      return;
    }

    // 비밀번호 4글자 이상
    if (newPassword.length < 4) {
      alert('비밀번호는 최소 4글자 이상이어야 합니다.');
      return;
    }

    // 비밀번호 확인 일치 검사
    if (newPassword !== confirmPassword) {
      alert('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    try {
      // 서버에 회원가입 데이터 전송
      const response = await fetch('http://localhost:8000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newUsername,
          newPassword,
          ipAddress,      // 필요 시 같이 보낼 수도 있습니다
          datetime: new Date().toLocaleString(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 가입 성공 메시지 표시
        setMessage(data.message || '회원가입 성공!');

        // 신규 회원 정보 리스트에 추가 (입력값 기준, 실제론 서버 DB 응답 데이터 따라야 함)
        setUserList(prev => [{
          username: newUsername,
          password: '*****',  // 비밀번호는 보여주지 않는 게 좋음
          ip: ipAddress,
          datetime: new Date().toLocaleString()
        }, ...prev]);

        // 입력 초기화
        setNewUsername('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage(data.message || '회원가입 실패');
      }
    } catch (err) {
      setMessage('서버와 통신 중 오류 발생');
      console.error('회원가입 에러:', err);
    }
  };

  return (
    <div className="user-create-page">
      <h2>회원가입 페이지</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="new-username">아이디:</label>
          <input
            type="text"
            id="new-username"
            name="new-username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="new-password">비밀번호:</label>
          <input
            type="password"
            id="new-password"
            name="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">비밀번호 확인:</label>
          <input
            type="password"
            id="confirm-password"
            name="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button type="submit">회원가입 완료</button>
      </form>

      {message && <p>{message}</p>}

      <h3>가입 목록</h3>
      <ul>
        {userList.map((user, idx) => (
          <li key={idx}>
            아이디: {user.username} | 등록일: {user.datetime} | IP: {user.ip}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserCreate;