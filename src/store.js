import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';      // 기존 유저 슬라이스
import apiKeyReducer from './apiKeySlice';  // 새로 추가한 API 키 슬라이스

const store = configureStore({
  reducer: {
    user: userReducer,
    apiKey: apiKeyReducer,
  },
});

export default store;