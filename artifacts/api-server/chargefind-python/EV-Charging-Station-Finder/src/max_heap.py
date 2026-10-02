class MaxHeap:

    def __init__(self):
        self.heap = []

    def push(self, item):
        self.heap.append(item)
        self._heapify_up(len(self.heap) - 1)

    def pop(self):

        if not self.heap:
            return None

        self._swap(0, len(self.heap) - 1)

        item = self.heap.pop()

        self._heapify_down(0)

        return item

    def peek(self):

        if not self.heap:
            return None

        return self.heap[0]

    def size(self):
        return len(self.heap)

    def _heapify_up(self, index):

        while index > 0:

            parent = (index - 1) // 2

            if self.heap[parent][0] >= self.heap[index][0]:
                break

            self._swap(parent, index)

            index = parent

    def _heapify_down(self, index):

        n = len(self.heap)

        while True:

            largest = index

            left = 2 * index + 1
            right = 2 * index + 2

            if (
                left < n
                and self.heap[left][0]
                > self.heap[largest][0]
            ):
                largest = left

            if (
                right < n
                and self.heap[right][0]
                > self.heap[largest][0]
            ):
                largest = right

            if largest == index:
                break

            self._swap(index, largest)

            index = largest

    def _swap(self, i, j):
        self.heap[i], self.heap[j] = (
            self.heap[j],
            self.heap[i]
        )