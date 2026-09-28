const FORBIDDEN_MESSAGE = 'You do not have permission to access this resource';

function requireRole(...roles) {
  const allowed = new Set(roles.flat());
  return function roleGuard(req, res, next) {
    if (!req.user || !allowed.has(req.user.role)) {
      res.status(403).json({
        success: false,
        message: FORBIDDEN_MESSAGE,
      });
      return;
    }
    next();
  };
}

export { requireRole, FORBIDDEN_MESSAGE };
