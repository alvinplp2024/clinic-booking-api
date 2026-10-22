class BookingError(Exception):
    """A business-rule error safe to translate into an API response."""

    def __init__(self, message: str, status_code: int = 400, code: str = "booking_error"):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)
