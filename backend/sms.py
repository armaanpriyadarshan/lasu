import os
from twilio.rest import Client

twilio = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
LASU_NUMBER = os.environ["TWILIO_PHONE_NUMBER"]
VERIFY_SID = os.environ["TWILIO_VERIFY_SERVICE_SID"]


def send_sms(to: str, body: str):
    twilio.messages.create(body=body, from_=LASU_NUMBER, to=to)


def send_verification(phone: str):
    twilio.verify.v2.services(VERIFY_SID).verifications.create(
        to=phone, channel="sms"
    )


def check_verification(phone: str, code: str) -> bool:
    result = twilio.verify.v2.services(VERIFY_SID).verification_checks.create(
        to=phone, code=code
    )
    return result.status == "approved"
