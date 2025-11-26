const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password)
      return res.status(400).json({ success:false, error: 'Email and password are required' });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ success:false, error: 'User already exists' });

    const newUser = new User({ email, password, name });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id.toString(), email: newUser.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

    res.status(201).json({ success:true, data: { user: { id: newUser._id, email: newUser.email, name: newUser.name }, token } });
  } catch (error) {
    res.status(500).json({ success:false, error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success:false, error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ success:false, error: 'Email does not exist' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success:false, error: 'Incorrect password' });

    const token = jwt.sign({ id: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

    res.json({ success:true, data: { user: { id: user._id, email: user.email, name: user.name }, token } });
  } catch (error) {
    res.status(500).json({ success:false, error: error.message });
  }
};
