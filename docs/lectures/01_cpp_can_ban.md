# 📘 CHUYÊN ĐỀ 01: C++ CĂN BẢN & KỸ THUẬT TỐI ƯU HÓA I/O
**Lớp:** Luyện Thi Chuyên Tin & HSG Tin Học  
**Giảng viên:** Thầy Phùng Đức  
**Ngôn ngữ:** C++17 / C++20  

---

## 1. TEMPLATE THI ĐẤU CHUẨN & FAST I/O

Trong lập trình thi đấu, số lượng test case và dữ liệu đầu vào có thể lên tới $10^6$ phần tử. Nếu sử dụng `cin` và `cout` mặc định của C++, chương trình rất dễ bị **Time Limit Exceeded (TLE)** do cơ chế đồng bộ hóa giữa luồng C và C++.

### Code Mẫu Chuẩn:
```cpp
#include <bits/stdc++.h>
using namespace std;

#define FAST_IO ios_base::sync_with_stdio(false); cin.tie(NULL); cout.tie(NULL);
#define int long long
#define all(x) (x).begin(), (x).end()
const int MOD = 1e9 + 7;
const int INF = 1e18;

void solve() {
    int n;
    if (!(cin >> n)) return;
    vector<int> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    
    // Xử lý bài toán...
    cout << n << "\n";
}

int32_t main() {
    FAST_IO;
    int t = 1;
    // cin >> t; // Bỏ comment nếu bài có nhiều test cases
    while (t--) {
        solve();
    }
    return 0;
}
```

> ⚠️ **Lưu ý quan trọng:**  
> - Luôn dùng `\n` thay cho `endl` vì `endl` tự động flush bộ đệm, làm chậm chương trình gấp 10 lần.
> - Sau khi đã dùng `cin.tie(NULL)`, tuyệt đối không dùng xen kẽ `scanf/printf` với `cin/cout`.

---

## 2. KỸ THUẬT MẢNG CỘNG DỒN (PREFIX SUM)

Cho mảng $A$ gồm $N$ phần tử. Cần trả lời $Q$ truy vấn tính tổng các phần tử từ chỉ số $L$ đến $R$.

### Phân tích độ phức tạp:
- **Cách ngây thơ (Brute Force):** Mỗi truy vấn duyệt vòng lặp từ $L$ đến $R \rightarrow O(Q \times N)$ (TLE với $N, Q \le 10^5$).
- **Mảng cộng dồn:** Tiền xử lý $O(N)$, trả lời mỗi truy vấn trong $O(1) \rightarrow O(N + Q)$ (AC tuyệt đối).

### Công thức:
$$Prefix[i] = Prefix[i - 1] + A[i]$$
$$Sum(L, R) = Prefix[R] - Prefix[L - 1]$$

---

## 3. BÀI TẬP RÈN LUYỆN
1. **[CF-71A] Way Too Long Words:** Xử lý chuỗi căn bản ([Codeforces](https://codeforces.com/problemset/problem/71/A))
2. **[VJ-CSES-1068] Weird Algorithm:** Bài toán Collatz ([VJudge](https://vjudge.net/problem/CSES-1068))
3. **[MARISA-1] Tổng hai số A + B:** Fast I/O ([MarisaOJ](https://marisaoj.com/problem/1))
