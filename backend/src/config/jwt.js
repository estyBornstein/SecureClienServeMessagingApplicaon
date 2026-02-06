if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}

module.exports = {
  secret: process.env.JWT_SECRET,
  expiration: process.env.JWT_EXPIRATION || '24h',
  algorithm: 'HS256'
};
