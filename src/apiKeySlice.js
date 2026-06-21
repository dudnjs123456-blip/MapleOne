import { createSlice } from '@reduxjs/toolkit';

const apiKeySlice = createSlice({
  name: 'apiKey',
  initialState: '',
  reducers: {
    setApiKey: (state, action) => action.payload,
    clearApiKey: () => '',
  },
});

export const { setApiKey, clearApiKey } = apiKeySlice.actions;
export default apiKeySlice.reducer;