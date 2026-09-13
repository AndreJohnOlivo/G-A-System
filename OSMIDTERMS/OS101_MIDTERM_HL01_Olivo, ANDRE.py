class node:
    def __init__(self, data):
        self.data = data
        self.next = None
    
class LinkedList:
    def __init__(self):
        self.head = None

    def insert_at_beginning(self, data):
        new_node = node(data)
        new_node.next = self.head
        self.head = new_node

    def insert_at_end(self,data):
        new_node = node(data)
        if not self.head:
            self.head = new_node
            return
        temp = self.head
        while temp.next:
            temp = temp.next
        temp.next = new_node

    def insert_at_position(self, data, pos):
        if pos == 0:
            self.insert_at_beginning(data)
            return
        new_node = node(data)
        temp = self.head
        for _ in range(pos - 1):
            if temp is None:
                print("Position is Out of Range")
                return
            temp = temp.next
        new_node.next = temp.next
        temp.next = new_node
    
    def delete_from_beginning(self):
        if self.head:
            self.head = self.head.next
        else:
            print("List is Empty")
    
    def delete_from_end(self):
        if not self.head:
            print("List is Empty")
            return
        if not self.head.next:
            self.head = None
            return
        temp = self.head
        while temp.next.next:
            temp = temp.next
        temp.next = None

    def delete_from_position(self, pos):
        if not self.head:
            print("List is Empty")
            return
        if pos == 0:
            self.head = self.head.next
            return
        temp = self.head
        for _ in range(pos - 1):
            if not temp.next:
                print("Position is Out of Range")
                return
            temp = temp.next
        temp.next = temp.next.next

    def display(self):
        temp = self.head
        while temp:
            print(temp.data, end=" -> ")
            temp = temp.next
        print("None")

def main():
    ll = LinkedList()
    while True:
        print("\nLinked List Operations:")
        print("1. Insert at Beginning")
        print("2. Insert at End")
        print("3. Insert at Position")
        print("4. Delete from Beginning")
        print("5. Delete from End")
        print("6. Delete from Position")
        print("7. Display")
        print("8. Exit")

        choice = int(input("Enter your choice: "))
        if choice == 1:
            data = int(input("Enter data: "))
            ll.insert_at_beginning(data)
        elif choice == 2:
            data = int(input("Enter data: "))
            ll.insert_at_end(data)
        elif choice == 3:
            data = int(input("Enter data: "))
            pos = int(input("Enter position: "))
            ll.insert_at_position(data, pos)
        elif choice == 4:
            ll.delete_from_beginning()
        elif choice == 5:
            ll.delete_from_end()
        elif choice == 6:
            pos = int(input("Enter position: "))
            ll.delete_from_position(pos)
        elif choice == 7:
            ll.display()
        elif choice == 8:
            break
        else:
            print("Invalid choice")
            
if __name__ == "__main__":
    main()