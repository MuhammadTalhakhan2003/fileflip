class AppError(Exception):
    """An error whose message is safe to show to the end user."""

    status_code = 400
    code = "bad_request"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.headers = headers or {}

    def __reduce__(self):
        # keep code/status when the error travels back from a worker process
        return _restore, (type(self), self.message, dict(self.__dict__))


def _restore(cls, message, state):
    error = cls.__new__(cls)
    Exception.__init__(error, message)
    error.__dict__.update(state)
    return error


class InvalidInput(AppError):
    status_code = 422
    code = "invalid_input"


class NotFound(AppError):
    status_code = 404
    code = "not_found"


class TooLarge(AppError):
    status_code = 413
    code = "file_too_large"


class RateLimited(AppError):
    status_code = 429
    code = "rate_limited"


class EngineUnavailable(AppError):
    status_code = 503
    code = "engine_unavailable"


class ConversionFailed(AppError):
    status_code = 500
    code = "conversion_failed"


class JobTimeout(AppError):
    status_code = 504
    code = "timeout"
