import api from './api';

export async function getAllPublicKeys() {
  const response = await api.get('/users/public-keys');
  return response.data.users;
}
