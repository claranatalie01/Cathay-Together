"""Request bodies for the itinerary service."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from . import config


class DateRange(BaseModel):
    start: date
    end: date

    @model_validator(mode="after")
    def _check(self):
        if self.end < self.start:
            raise ValueError("The trip end date is before the start date.")
        if (self.end - self.start).days + 1 > config.MAX_TRIP_DAYS:
            raise ValueError(f"Trips longer than {config.MAX_TRIP_DAYS} days are not supported.")
        return self


class FlightInfo(BaseModel):
    member: str
    origin: str = ""
    destination: str = ""
    arrival_date: str | None = None
    arrival_time: str | None = None
    departure_date: str | None = None
    departure_time: str | None = None


class TripContext(BaseModel):
    destination: str = Field(min_length=1, max_length=100)
    dates: DateRange
    group_size: int = Field(ge=1, le=8)
    interests: list[str] = Field(default_factory=list, max_length=12)
    budget_per_person: int = Field(default=config.DEFAULT_BUDGET_PER_PERSON, ge=0)
    budget_level: str = "moderate"
    pace: Literal["relaxed", "moderate", "packed"] = "moderate"
    flights: list[FlightInfo] = Field(default_factory=list, max_length=8)


MODEL_PATTERN = r"^[A-Za-z0-9._:-]{1,60}$"  # a Poe bot name; anything else is rejected


class DiscoverRequest(BaseModel):
    context: TripContext
    model: str | None = Field(default=None, pattern=MODEL_PATTERN)


class PlanRequest(BaseModel):
    context: TripContext
    # The places returned by /discover, each with like_count and total_members added by the app.
    cards: list[dict] = Field(min_length=1, max_length=40)
    sources: list[dict] = Field(default_factory=list, max_length=40)
    model: str | None = Field(default=None, pattern=MODEL_PATTERN)
