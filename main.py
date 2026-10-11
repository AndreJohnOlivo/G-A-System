def vulnerable():
    buffer_size = 10
    buffer = [''] * buffer_size  # fixed-size buffer
    print("Enter some text (max 10 chars): ")
    user_input = input()
    # Simulate writing into buffer without bounds checking
    for i in range(len(user_input)):
        try:
            buffer[i] = user_input[i]
        except IndexError:
            print("Buffer overflow occurred! Redirecting execution...")
            secret()
            return
    print("Buffer content:", buffer)


def secret():
    print("Secret function executed! System compromised...")


def safe():
    buffer_size = 10
    print("Enter some text (max 10 chars): ")
    user_input = input()
    if len(user_input) > buffer_size:
        print("Input too long! Truncated safely.")
        user_input = user_input[:buffer_size]
    print("Buffer content:", list(user_input))


def main():
    print("=== Vulnerable Version ===")
    vulnerable()

    print("\n=== Safe Version ===")
    safe()

    print("\nProgram finished normally.")


if __name__ == "__main__":
    main()