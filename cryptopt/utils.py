import datetime
import pytz


def get_current_time():
    return datetime.datetime.utcnow().replace(tzinfo=pytz)
