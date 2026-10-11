#include <stdio.h>
#include <string.h>

void secret() {
    printf("You have entered a secret function!\n");
    printf("System Compromised...\n");
}

// Mimics the old gets() behavior: no bounds checking, reads until newline/EOF
void unsafe_gets(char *buf) {
    int c;
    char *p = buf;
    while ((c = getchar()) != '\n' && c != EOF) {
        *p++ = (char)c;
    }
    *p = '\0';
}

void vulnerable() {
    char buffer[20];
    printf("Enter some text: ");
    unsafe_gets(buffer); // No bounds checking - intentionally vulnerable
    printf("You Entered: %s\n", buffer);
}

int main() {
    vulnerable();
    return 0;
}