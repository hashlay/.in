const { ActivityLog } = require('../models/index');

const logActivity = (module, action, getDetails) => async (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Restore original immediately — call it first, log after
    res.json = originalJson;
    const result = originalJson(data);

    // Fire-and-forget async log — never blocks the response
    setImmediate(async () => {
      try {
        const status = data?.success === false ? 'failure' : 'success';
        await ActivityLog.create({
          admin:     req.admin?._id,
          adminName: req.admin?.name || 'System',
          action,
          module,
          details:   typeof getDetails === 'function' ? getDetails(req, data) : action,
          ip:        req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          status,
          meta:      { method: req.method, path: req.path },
        });
      } catch (err) {
        // Log silently, never crash the request
        console.error('ActivityLog error:', err.message);
      }
    });

    return result;
  };

  next();
};

module.exports = logActivity;