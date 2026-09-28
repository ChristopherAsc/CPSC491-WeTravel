from database import Base, engine
import models

print("Creating database tables...")

Base.metadata.create_all(bind=engine)

print("Database tables created.")
