// src/App.js 파일 - 라우터 전용
import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 이 두 import 문이 다른 import 문들보다 위에 있고,
// UserCreate와 Mainpage가 서로 App.js를 임포트하지 않는지 확인해주세요.
import Mainpage from './Mainpage';
import UserCreate from './UserCreate';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Mainpage />} />
      <Route path="/signup" element={<UserCreate />} />
    </Routes>
  );
}

export default App;