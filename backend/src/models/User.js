const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
    },
    college: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      default: 1200,
    },
    xp: {
      type: Number,
      default: 0,
    },
    badges: {
      type: [String],
      default: [],
    },
    stats: {
      problemsSolved: { type: Number, default: 0 },
      submissions: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: {
      transform(doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
