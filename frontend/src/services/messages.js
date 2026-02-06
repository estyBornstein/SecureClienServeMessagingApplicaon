import api from './api';
import { POLL_REQUEST_TIMEOUT } from '../config/constants';

export async function sendMessage(encryptedContent, iv, keys) {
  const response = await api.post('/messages/send', { encryptedContent, iv, keys });
  return response.data;
}

export async function pollMessages(signal) {
  const response = await api.get('/messages/poll', {
    signal,
    timeout: POLL_REQUEST_TIMEOUT,
  });
  return response.data;
}

export async function getHistory(page = 1, pageSize = 50) {
  const response = await api.get('/messages/history', {
    params: { page, pageSize },
  });
  return response.data;
}
