
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text

from database import Base


class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    item_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    source_url = Column(String(2000), nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )