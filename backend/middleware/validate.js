const { body, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Auth validation chains
const validateSignup = [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').trim().isEmail().withMessage('A valid email is required'),
  handleValidation
];

const validateLogin = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('access_code').trim().notEmpty().withMessage('Access code is required'),
  handleValidation
];

const validateAdminLogin = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').trim().notEmpty().withMessage('Password is required'),
  handleValidation
];

const validateTutorLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').trim().notEmpty().withMessage('Password is required'),
  handleValidation
];

// Order validation
const validateOrder = [
  body('order_type_id').isInt().withMessage('Valid order type is required'),
  body('course_name').trim().isLength({ min: 1, max: 255 }).withMessage('Course name is required'),
  body('subject_id').isInt().withMessage('Valid subject is required'),
  body('education_level_id').isInt().withMessage('Valid education level is required'),
  body('plan_id').isInt().withMessage('Valid plan is required'),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').isISO8601().withMessage('Valid end date is required'),
  handleValidation
];

// Tutor validation
const validateTutor = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Name must be 2-150 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidation
];

// Chat message validation
const validateMessage = [
  body('message').trim().isLength({ min: 1, max: 5000 }).withMessage('Message must be 1-5000 characters'),
  body('order_id').isInt().withMessage('Valid order ID is required'),
  handleValidation
];

module.exports = {
  validateSignup,
  validateLogin,
  validateAdminLogin,
  validateTutorLogin,
  validateOrder,
  validateTutor,
  validateMessage,
  handleValidation
};
