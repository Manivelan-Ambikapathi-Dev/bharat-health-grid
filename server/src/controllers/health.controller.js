function getHealth(_req, res) {
  res.status(200).json({
    success: true,
    message: 'Bharat Health Grid API is running',
  });
}

export { getHealth };
