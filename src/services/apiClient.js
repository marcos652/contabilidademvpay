import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/movingpay',
});

export default apiClient;
