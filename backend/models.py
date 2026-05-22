from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Soil inputs
    N = Column(Float, nullable=False)
    P = Column(Float, nullable=False)
    K = Column(Float, nullable=False)
    ph = Column(Float, nullable=False)
    location = Column(String(255), nullable=False)

    # Results
    top_crop = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)

    # Weather data used
    temperature = Column(Float)
    humidity = Column(Float)
    rainfall = Column(Float)

    # Metadata
    is_suitable = Column(Boolean, default=True)
    alert_message = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="predictions")


class ChatMessage(Base):
    """Stores Varsha chatbot conversation history."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), index=True, nullable=False)  # anonymous session UUID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # NULL for guests
    role = Column(String(10), nullable=False)   # 'user' or 'bot'
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_messages")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    rating = Column(Integer, nullable=False)  # e.g., 1 to 5
    comment = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)  # e.g., 'prediction', 'chatbot', 'general'
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedbacks")
