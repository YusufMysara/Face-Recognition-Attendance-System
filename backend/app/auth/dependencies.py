import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.utils.security import decode_token

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        logger.debug("Decoded JWT payload: %s", payload)
        user_id_raw = payload.get("sub")
        role: str = payload.get("role")
        if user_id_raw is None or role is None:
            logger.warning("Token missing sub or role")
            raise credentials_exception
        try:
            user_id = int(user_id_raw)
        except (TypeError, ValueError):
            logger.warning("Token sub is not int-convertible: %s", user_id_raw)
            raise credentials_exception
    except JWTError as exc:
        logger.warning("JWT decode failed: %s", exc)
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        logger.warning("User %s from token not found", user_id)
        raise credentials_exception
    return user


def require_role(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return dependency

