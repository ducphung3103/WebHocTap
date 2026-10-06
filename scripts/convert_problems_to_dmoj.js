const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'docs', 'data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const DMOJ_PROBLEMS_META = {
  'MARISA-1': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Cơ bản', 'Nhập xuất', 'Toán học'],
    description: 'Cho hai số nguyên $A$ và $B$. Nhiệm vụ của bạn là tính tổng của hai số này.',
    input_specification: 'Một dòng duy nhất chứa hai số nguyên $A$ và $B$ cách nhau bởi dấu cách.',
    output_specification: 'In ra một số nguyên duy nhất là tổng $A + B$.',
    constraints: '$-10^9 \\le A, B \\le 10^9$',
    sample_cases: [
      { input: '3 5\n', output: '8\n', explanation: 'Tổng của 3 và 5 là 8.' },
      { input: '-10 25\n', output: '15\n', explanation: 'Tổng của -10 và 25 là 15.' }
    ]
  },
  'MARISA-2': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Cơ bản', 'Hình học', 'Toán học'],
    description: 'Cho chiều dài $a$ và chiều rộng $b$ của hình chữ nhật. Hãy tính chu vi và diện tích của hình chữ nhật đó.',
    input_specification: 'Một dòng chứa hai số nguyên dương $a$ và $b$ cách nhau bởi dấu cách.',
    output_specification: 'In ra hai số nguyên lần lượt là chu vi và diện tích trên cùng một dòng, cách nhau bởi dấu cách.',
    constraints: '$1 \\le a, b \\le 10^4$',
    sample_cases: [
      { input: '3 4\n', output: '14 12\n', explanation: 'Chu vi: (3+4)*2 = 14. Diện tích: 3*4 = 12.' }
    ]
  },
  'MARISA-3': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Cơ bản', 'Toán học', 'Số học'],
    description: 'Cho hai số nguyên dương $a$ và $b$. Hãy in ra thương nguyên và số dư của phép chia $a$ cho $b$.',
    input_specification: 'Dòng duy nhất chứa hai số nguyên dương $a$ và $b$ ($b > 0$).',
    output_specification: 'In ra hai số nguyên là thương nguyên $a / b$ và phần dư $a \\% b$ cách nhau bởi dấu cách.',
    constraints: '$1 \\le a, b \\le 10^9$',
    sample_cases: [
      { input: '17 5\n', output: '3 2\n', explanation: '17 chia 5 được 3 dư 2.' }
    ]
  },
  'MARISA-4': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Rẽ nhánh', 'Hình học', 'Cơ bản'],
    description: 'Cho 3 số nguyên dương $a, b, c$. Kiểm tra xem ba số này có thể tạo thành ba cạnh của một tam giác hay không.',
    input_specification: 'Một dòng chứa 3 số nguyên dương $a, b, c$ cách nhau bởi dấu cách.',
    output_specification: 'In ra "YES" nếu tạo thành tam giác, ngược lại in ra "NO".',
    constraints: '$1 \\le a, b, c \\le 10^6$',
    sample_cases: [
      { input: '3 4 5\n', output: 'YES\n', explanation: '3, 4, 5 thỏa mãn bất đẳng thức tam giác.' },
      { input: '1 2 3\n', output: 'NO\n', explanation: '1 + 2 = 3 không thỏa mãn tổng 2 cạnh lớn hơn cạnh còn lại.' }
    ]
  },
  'MARISA-6': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Cơ bản', 'Toán học'],
    description: 'Có $N$ viên kẹo chia đều cho $K$ em bé. Hãy tính xem mỗi em bé nhận được nhiều nhất bao nhiêu viên kẹo và còn thừa lại bao nhiêu viên kẹo.',
    input_specification: 'Một dòng gồm hai số nguyên dương $N$ và $K$ ($K > 0$).',
    output_specification: 'In ra hai số nguyên: số kẹo mỗi em nhận được và số kẹo còn dư.',
    constraints: '$1 \\le N, K \\le 10^9$',
    sample_cases: [
      { input: '23 4\n', output: '5 3\n', explanation: 'Mỗi em 5 cái kẹo, dư 3 cái kẹo.' }
    ]
  },
  'MARISA-7': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Tham lam', 'Toán học', 'Cơ bản'],
    description: 'Cho số tiền $N$ đồng. Cần đổi số tiền này ra các tờ tiền mệnh giá 500, 200, 100, 50, 20, 10, 5, 2, 1 sao cho tổng số tờ tiền là ít nhất.',
    input_specification: 'Một dòng chứa số nguyên dương $N$.',
    output_specification: 'In ra số lượng tờ tiền tối thiểu cần dùng.',
    constraints: '$1 \\le N \\le 10^9$',
    sample_cases: [
      { input: '578\n', output: '6\n', explanation: '1 tờ 500 + 1 tờ 50 + 1 tờ 20 + 1 tờ 5 + 1 tờ 2 + 1 tờ 1 = 6 tờ.' }
    ]
  },
  'MARISA-8': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Số học', 'Toán học', 'Cơ bản'],
    description: 'Cho ba số nguyên dương $a, b, c$. Hãy tính giá trị biểu thức: $(a \\times b) \\pmod c$. Lưu ý tránh tràn số khi nhân.',
    input_specification: 'Một dòng chứa 3 số nguyên $a, b, c$ ($c > 0$).',
    output_specification: 'In ra kết quả của $(a \\times b) \\pmod c$.',
    constraints: '$1 \\le a, b, c \\le 10^9$',
    sample_cases: [
      { input: '1000000 2000000 998244353\n', output: '3511294\n', explanation: 'Nhân 64-bit rồi chia lấy dư.' }
    ]
  },
  'MARISA-10': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Vòng lặp', 'Số học', 'Cơ bản'],
    description: 'Cho số nguyên dương $N$. Hãy tính tổng tất cả các chữ số của $N$.',
    input_specification: 'Một dòng duy nhất chứa số nguyên dương $N$.',
    output_specification: 'In ra tổng các chữ số của $N$.',
    constraints: '$1 \\le N \\le 10^{18}$',
    sample_cases: [
      { input: '12345\n', output: '15\n', explanation: '1 + 2 + 3 + 4 + 5 = 15.' }
    ]
  },
  'MARISA-11': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Vòng lặp', 'Số học', 'Cơ bản'],
    description: 'Cho số nguyên dương $N$. Hãy in ra số nhận được khi đảo ngược các chữ số của $N$ (bỏ các chữ số 0 ở đầu).',
    input_specification: 'Một dòng chứa số nguyên dương $N$.',
    output_specification: 'In ra số nguyên sau khi đảo ngược.',
    constraints: '$1 \\le N \\le 10^9$',
    sample_cases: [
      { input: '12340\n', output: '4321\n', explanation: 'Đảo ngược 12340 thành 04321, bỏ số 0 ở đầu được 4321.' }
    ]
  },
  'MARISA-13': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Xử lý xâu', 'Cơ bản'],
    description: 'Cho một ký tự chữ cái $c$. Nếu $c$ là chữ thường, hãy đổi thành chữ hoa; nếu $c$ là chữ hoa, hãy đổi thành chữ thường.',
    input_specification: 'Một ký tự chữ cái duy nhất $c$ thuộc bảng chữ cái tiếng Anh.',
    output_specification: 'In ra ký tự sau khi chuyển đổi.',
    constraints: '$c \\in [\'a\'..\'z\', \'A\'..\'Z\']$',
    sample_cases: [
      { input: 'a\n', output: 'A\n', explanation: 'Đổi từ thường sang hoa.' },
      { input: 'B\n', output: 'b\n', explanation: 'Đổi từ hoa sang thường.' }
    ]
  },
  'MARISA-14': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Xử lý xâu', 'Tìm kiếm', 'Cơ bản'],
    description: 'Cho xâu ký tự $S$ và một ký tự $c$. Hãy đếm số lần ký tự $c$ xuất hiện trong xâu $S$ (phân biệt hoa thường).',
    input_specification: 'Dòng 1: xâu ký tự $S$. Dòng 2: ký tự $c$.',
    output_specification: 'In ra số lần ký tự $c$ xuất hiện trong xâu $S$.',
    constraints: '$1 \\le |S| \\le 1000$',
    sample_cases: [
      { input: 'laptrinhthidau\na\n', output: '2\n', explanation: 'Ký tự a xuất hiện 2 lần.' }
    ]
  },
  'MARISA-15': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Xử lý xâu', 'Cơ bản'],
    description: 'Cho xâu ký tự $S$. In xâu ký tự $S$ ra màn hình chuẩn.',
    input_specification: 'Một dòng chứa xâu ký tự $S$ (có thể chứa khoảng trắng).',
    output_specification: 'In lại chính xác xâu $S$.',
    constraints: '$1 \\le |S| \\le 1000$',
    sample_cases: [
      { input: 'Hello Competitive Programming!\n', output: 'Hello Competitive Programming!\n', explanation: 'In nguyên xâu.' }
    ]
  },
  'MARISA-16': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Vòng lặp', 'Toán học', 'Cơ bản'],
    description: 'Một tờ giấy có độ dày $0.1$ mm ($0.0001$ mét). Mỗi lần gấp đôi, độ dày tờ giấy tăng gấp 2 lần. Cần gấp ít nhất bao nhiêu lần để độ dày tờ giấy đạt hoặc vượt quá độ cao $H$ mét?',
    input_specification: 'Một số thực dương $H$ biểu thị độ cao theo đơn vị mét.',
    output_specification: 'In ra số lần gấp tối thiểu.',
    constraints: '$0.001 \\le H \\le 10^9$',
    sample_cases: [
      { input: '0.001\n', output: '4\n', explanation: 'Độ dày ban đầu 0.0001m. Gấp 4 lần đạt 0.0016m >= 0.001m.' }
    ]
  },
  'MARISA-20': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Mảng', 'Vòng lặp', 'Cơ bản'],
    description: 'Cho mảng gồm $N$ số nguyên. Hãy đếm xem trong mảng có bao nhiêu số chẵn.',
    input_specification: 'Dòng 1: số nguyên $N$. Dòng 2: $N$ số nguyên cách nhau bởi dấu cách.',
    output_specification: 'In ra số lượng số chẵn trong mảng.',
    constraints: '$1 \\le N \\le 10^5, |A_i| \\le 10^9$',
    sample_cases: [
      { input: '5\n1 2 3 4 6\n', output: '3\n', explanation: 'Có 3 số chẵn là 2, 4, 6.' }
    ]
  },
  'MARISA-42': {
    points: 15,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Mảng', 'Cơ bản'],
    description: 'Cho mảng gồm $N$ số nguyên. Hãy in toàn bộ các số chẵn trước theo thứ tự xuất hiện, sau đó in toàn bộ các số lẻ theo thứ tự xuất hiện.',
    input_specification: 'Dòng 1: số nguyên $N$. Dòng 2: $N$ số nguyên.',
    output_specification: 'In ra các số theo yêu cầu trên cùng một dòng, cách nhau bởi dấu cách.',
    constraints: '$1 \\le N \\le 10^5, |A_i| \\le 10^9$',
    sample_cases: [
      { input: '6\n1 4 3 6 8 5\n', output: '4 6 8 1 3 5\n', explanation: 'Số chẵn (4, 6, 8) trước, số lẻ (1, 3, 5) sau.' }
    ]
  },
  'MARISA-314': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Vòng lặp', 'Số học'],
    description: 'Cho số nguyên dương $N$. Hãy tìm chữ số có giá trị lớn nhất trong các chữ số của $N$.',
    input_specification: 'Một số nguyên dương $N$.',
    output_specification: 'In ra chữ số lớn nhất.',
    constraints: '$1 \\le N \\le 10^{18}$',
    sample_cases: [
      { input: '52941\n', output: '9\n', explanation: 'Chữ số lớn nhất là 9.' }
    ]
  },
  'MARISA-396': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Rẽ nhánh', 'Toán học'],
    description: 'Cây nấm A có độ độc $x$, cây nấm B có độ độc $y$. Nếu $x > y$ in "A", nếu $y > x$ in "B", nếu bằng nhau in "EQUAL".',
    input_specification: 'Một dòng chứa hai số thực $x$ và $y$.',
    output_specification: 'In ra "A", "B" hoặc "EQUAL".',
    constraints: '$0 \\le x, y \\le 10^9$',
    sample_cases: [
      { input: '4.5 3.2\n', output: 'A\n', explanation: '4.5 > 3.2 nên in A.' }
    ]
  },
  'MARISA-397': {
    points: 15,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Toán học', 'Rẽ nhánh'],
    description: 'Giải và biện luận phương trình bậc nhất $ax + b = 0$. In "VO SO NGHIEM" nếu vô số nghiệm, "VO NGHIEM" nếu vô nghiệm, hoặc nghiệm $x$ làm tròn 2 chữ số thập phân.',
    input_specification: 'Hai số thực $a$ và $b$ cách nhau bởi dấu cách.',
    output_specification: 'In ra kết quả theo yêu cầu.',
    constraints: '$-10^6 \\le a, b \\le 10^6$',
    sample_cases: [
      { input: '2 -4\n', output: '2.00\n', explanation: '2x - 4 = 0 => x = 2.00.' },
      { input: '0 5\n', output: 'VO NGHIEM\n', explanation: '0x + 5 = 0 vô nghiệm.' }
    ]
  },
  'MARISA-401': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Mảng', 'Toán học'],
    description: 'Mario đi qua $N$ cây nấm, cây nấm thứ $i$ cho $A_i$ điểm sức mạnh. Nếu ăn nấm có $A_i < 0$ thì sức mạnh bị trừ. Tính tổng sức mạnh sau khi ăn hết $N$ cây nấm.',
    input_specification: 'Dòng 1: số $N$. Dòng 2: $N$ số nguyên $A_i$.',
    output_specification: 'In ra tổng điểm sức mạnh.',
    constraints: '$1 \\le N \\le 10^5, |A_i| \\le 10^4$',
    sample_cases: [
      { input: '4\n5 -2 8 1\n', output: '12\n', explanation: '5 + (-2) + 8 + 1 = 12.' }
    ]
  },
  'MARISA-402': {
    points: 15,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Toán học', 'Vòng lặp'],
    description: 'Một tấm bản đồ ban đầu có kích thước $W \\times H$. Mỗi lần gấp đôi theo cạnh lớn hơn (nếu bằng nhau thì gấp theo $W$). Tính kích thước sau $K$ lần gấp.',
    input_specification: 'Ba số nguyên $W, H, K$.',
    output_specification: 'In ra kích thước $W\'$ và $H\'$ sau $K$ lần gấp.',
    constraints: '$1 \\le W, H \\le 10^9, 1 \\le K \\le 60$',
    sample_cases: [
      { input: '16 8 2\n', output: '4 8\n', explanation: 'Lần 1: 16x8 -> 8x8. Lần 2: 8x8 -> 4x8.' }
    ]
  },
  'MARISA-405': {
    points: 15,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Mảng', 'Thuật toán cơ sở'],
    description: 'Cho mảng gồm $N$ số nguyên. Hãy tìm giá trị lớn nhất, nhỏ nhất và tính giá trị trung bình cộng của các phần tử trong mảng (làm tròn 2 chữ số thập phân).',
    input_specification: 'Dòng 1: số nguyên $N$. Dòng 2: $N$ số nguyên.',
    output_specification: 'In ra trên 1 dòng gồm 3 giá trị: Max, Min và Trung bình cộng cách nhau bởi dấu cách.',
    constraints: '$1 \\le N \\le 10^5, |A_i| \\le 10^9$',
    sample_cases: [
      { input: '4\n2 5 1 4\n', output: '5 1 3.00\n', explanation: 'Max=5, Min=1, Avg=3.00.' }
    ]
  },
  'MARISA-416': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Rẽ nhánh', 'Số học'],
    description: 'Cho số nguyên dương $N$. Kiểm tra xem $N$ có đồng thời chia hết cho cả 3 và 5 nhưng KHÔNG chia hết cho 2 hay không. In "YES" hoặc "NO".',
    input_specification: 'Một số nguyên dương $N$.',
    output_specification: 'In "YES" nếu thỏa mãn, ngược lại in "NO".',
    constraints: '$1 \\le N \\le 10^9$',
    sample_cases: [
      { input: '15\n', output: 'YES\n', explanation: '15 chia hết cho 3 và 5, không chia hết cho 2.' },
      { input: '30\n', output: 'NO\n', explanation: '30 chia hết cho 2 nên không thỏa mãn.' }
    ]
  },
  'MARISA-419': {
    points: 15,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Hình học', 'Toán học'],
    description: 'Cho tọa độ điểm $M(x, y)$ và đoạn thẳng nối hai điểm $A(x_1, y_1), B(x_2, y_2)$. Kiểm tra xem điểm $M$ có nằm trên đoạn thẳng $AB$ hay không.',
    input_specification: 'Gồm 6 số nguyên: $x, y, x_1, y_1, x_2, y_2$.',
    output_specification: 'In "YES" nếu điểm $M$ thuộc đoạn thẳng $AB$, ngược lại in "NO".',
    constraints: '$-10^6 \\le x, y, x_1, y_1, x_2, y_2 \\le 10^6$',
    sample_cases: [
      { input: '2 2 0 0 4 4\n', output: 'YES\n', explanation: 'Điểm (2,2) là trung điểm của đoạn thẳng nối (0,0) và (4,4).' }
    ]
  },
  'MARISA-499': {
    points: 15,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Số học', 'Vòng lặp'],
    description: 'Cho số nguyên dương $N$. Hãy tính tổng tất cả các ước nguyên dương của $N$. Lưu ý dùng thuật toán duyệt tới $\\sqrt{N}$.',
    input_specification: 'Một số nguyên dương $N$.',
    output_specification: 'In ra tổng các ước của $N$.',
    constraints: '$1 \\le N \\le 10^{12}$',
    sample_cases: [
      { input: '12\n', output: '28\n', explanation: 'Các ước là 1, 2, 3, 4, 6, 12. Tổng = 28.' }
    ]
  },
  'MARISA-535': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Rẽ nhánh', 'Toán học'],
    description: 'Lập trình máy tính đơn giản thực hiện 4 phép toán cơ bản: +, -, *, /. Cho biểu thức dạng "$A \\text{ op } B$". Hãy in kết quả (với phép chia làm tròn 2 chữ số thập phân).',
    input_specification: 'Gồm 3 phần tử: $A$, toán tử $\\text{op} \\in [\'+\', \'-\', \'*\', \'/\']$ và $B$.',
    output_specification: 'In ra kết quả của phép tính.',
    constraints: '$-10^6 \\le A, B \\le 10^6, B \\ne 0$ khi chia.',
    sample_cases: [
      { input: '10 / 4\n', output: '2.50\n', explanation: '10 chia 4 được 2.50.' }
    ]
  },
  'MARISA-536': {
    points: 15,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Số học', 'Xử lý xâu'],
    description: 'Cho số nguyên dương $N$. Một số được gọi là số đối xứng (palindrome) nếu đọc từ trái sang phải hay từ phải sang trái đều giống nhau. Kiểm tra xem $N$ có đối xứng không.',
    input_specification: 'Một dòng chứa số nguyên dương $N$.',
    output_specification: 'In "YES" nếu $N$ là số đối xứng, ngược lại in "NO".',
    constraints: '$1 \\le N \\le 10^{18}$',
    sample_cases: [
      { input: '12321\n', output: 'YES\n', explanation: '12321 đọc xuôi ngược như nhau.' },
      { input: '12345\n', output: 'NO\n', explanation: 'Không đối xứng.' }
    ]
  },
  'MARISA-537': {
    points: 15,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Dãy số', 'Quy hoạch động', 'Toán học'],
    description: 'Cho dãy số $u_1 = 1$, $u_n = 2u_{n-1} + 1$ với mọi $n \\ge 2$. Cho số nguyên $N$. Hãy tính số hạng thứ $N$ của dãy theo modulo $10^9 + 7$.',
    input_specification: 'Một số nguyên dương $N$.',
    output_specification: 'In ra $u_N \\pmod{10^9 + 7}$.',
    constraints: '$1 \\le N \\le 10^{18}$',
    sample_cases: [
      { input: '3\n', output: '7\n', explanation: 'u1=1, u2=3, u3=7.' }
    ]
  },
  'MARISA-541': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Số học', 'Toán học'],
    description: 'Cho số nguyên dương $N$. Kiểm tra xem $N$ có phải là số chính phương (bình phương của một số nguyên) hay không. In "YES" hoặc "NO".',
    input_specification: 'Một số nguyên dương $N$.',
    output_specification: 'In "YES" hoặc "NO".',
    constraints: '$1 \\le N \\le 10^{18}$',
    sample_cases: [
      { input: '25\n', output: 'YES\n', explanation: '25 = 5^2 là số chính phương.' },
      { input: '26\n', output: 'NO\n', explanation: '26 không phải số chính phương.' }
    ]
  },
  'MARISA-587': {
    points: 15,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'MarisaOJ / Thầy Phùng Đức',
    types: ['Cơ số', 'Xử lý xâu'],
    description: 'Cho số nguyên không âm $N$ ở hệ thập phân. Hãy chuyển đổi và in ra biểu diễn nhị phân (cơ số 2) của $N$.',
    input_specification: 'Một số nguyên không âm $N$.',
    output_specification: 'In ra chuỗi nhị phân của $N$.',
    constraints: '$0 \\le N \\le 10^9$',
    sample_cases: [
      { input: '13\n', output: '1101\n', explanation: '13 = 8 + 4 + 1 -> 1101_2.' }
    ]
  },
  'CF-486C': {
    points: 30,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Codeforces',
    types: ['Tham lam', 'Xử lý xâu', 'Hai con trỏ'],
    description: 'Cho xâu $S$ gồm $N$ chữ cái in thường và vị trí con trỏ ban đầu $p$. Bạn có thể di chuyển con trỏ sang trái/phải hoặc thay đổi ký tự tại vị trí con trỏ theo vòng tròn chữ cái (\'a\' <-> \'z\'). Hãy tìm số thao tác tối thiểu để biến $S$ thành xâu đối xứng.',
    input_specification: 'Dòng 1: $N, p$. Dòng 2: xâu $S$.',
    output_specification: 'In ra số thao tác ít nhất.',
    constraints: '$1 \\le N \\le 10^5, 1 \\le p \\le N$',
    sample_cases: [
      { input: '8 3\naeabcaez\n', output: '6\n', explanation: 'Thay đổi các ký tự đối xứng và di chuyển con trỏ tối ưu.' }
    ]
  },
  'CF-214B': {
    points: 30,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Codeforces',
    types: ['Số học', 'Tham lam', 'Quy hoạch động'],
    description: 'Cho tập hợp gồm $N$ chữ số. Hãy tìm số nguyên lớn nhất có thể tạo thành từ một số hoặc tất cả các chữ số đã cho sao cho số đó chia hết cho 2, 3 và 5 (tức chia hết cho 30). Nếu không thể tạo thành, in -1.',
    input_specification: 'Dòng 1: số $N$. Dòng 2: $N$ chữ số cách nhau bởi dấu cách.',
    output_specification: 'In ra số lớn nhất tìm được, hoặc -1.',
    constraints: '$1 \\le N \\le 10^5$',
    sample_cases: [
      { input: '4\n0 1 2 3\n', output: '210\n', explanation: '210 chia hết cho 30.' }
    ]
  },
  'CF-231C': {
    points: 40,
    time_limit: '2.0s',
    memory_limit: '256M',
    author: 'Codeforces',
    types: ['Hai con trỏ', 'Chặt nhị phân', 'Mảng cộng dồn'],
    description: 'Cho mảng $N$ số nguyên và số $k$. Bạn có thể tăng giá trị bất kỳ phần tử nào lên 1 tối đa $k$ lần. Hãy tìm giá trị có thể đạt được tần số xuất hiện nhiều nhất và số lần xuất hiện đó.',
    input_specification: 'Dòng 1: $N, k$. Dòng 2: $N$ số nguyên.',
    output_specification: 'In ra số lần xuất hiện tối đa và giá trị nhỏ nhất đạt được tần số đó.',
    constraints: '$1 \\le N \\le 10^5, 0 \\le k \\le 10^9$',
    sample_cases: [
      { input: '3 2\n3 1 4\n', output: '2 3\n', explanation: 'Tăng 1 lên 3 (tốn 2 thao tác), được hai số 3.' }
    ]
  },
  'CSES-1628': {
    points: 50,
    time_limit: '1.0s',
    memory_limit: '512M',
    author: 'CSES Problem Set',
    types: ['Meet in the Middle', 'Chặt nhị phân', 'Tìm kiếm'],
    description: 'Cho mảng gồm $N$ số nguyên dương và số $x$. Hãy đếm số lượng tập con có tổng các phần tử bằng đúng $x$. Kỹ thuật chia mảng làm 2 nửa ($N/2 \\le 20$) rồi sinh tập con.',
    input_specification: 'Dòng 1: $N, x$. Dòng 2: $N$ số nguyên dương $A_i$.',
    output_specification: 'In ra số lượng tập con thỏa mãn.',
    constraints: '$1 \\le N \\le 40, 1 \\le x, A_i \\le 10^9$',
    sample_cases: [
      { input: '4 5\n1 2 3 2\n', output: '3\n', explanation: 'Có 3 cách: {1, 2, 2}, {2, 3}, {3, 2}.' }
    ]
  },
  'CPP-EX-01': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Mảng', 'Nhập xuất', 'Cơ bản'],
    description: 'Viết chương trình nhập vào một mảng gồm đúng 10 số tự nhiên. In lại 10 số đó ra màn hình trên một dòng duy nhất, mỗi số cách nhau bởi đúng một dấu cách.',
    input_specification: 'Một dòng chứa 10 số tự nhiên cách nhau bởi dấu cách.',
    output_specification: 'In ra 10 số tự nhiên đó trên một dòng cách nhau bởi dấu cách.',
    constraints: 'Các số trong khoảng $[0..10^6]$',
    sample_cases: [
      { input: '1 2 3 4 5 6 7 8 9 10\n', output: '1 2 3 4 5 6 7 8 9 10\n', explanation: 'In lại 10 phần tử theo đúng thứ tự.' }
    ],
    testcases: [
      { input: '1 2 3 4 5 6 7 8 9 10\n', output: '1 2 3 4 5 6 7 8 9 10\n', sample: true },
      { input: '10 20 30 40 50 60 70 80 90 100\n', output: '10 20 30 40 50 60 70 80 90 100\n', sample: false },
      { input: '0 0 0 0 0 0 0 0 0 0\n', output: '0 0 0 0 0 0 0 0 0 0\n', sample: false },
      { input: '9 8 7 6 5 4 3 2 1 0\n', output: '9 8 7 6 5 4 3 2 1 0\n', sample: false }
    ]
  },
  'CPP-EX-02': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Mảng', 'Chỉ số', 'Cơ bản'],
    description: 'Cho số nguyên dương lẻ $N$ và mảng gồm $N$ số nguyên. Hãy in ra phần tử nằm ở chính giữa mảng (vị trí có chỉ số $(N - 1) / 2$ khi đánh chỉ số từ 0).',
    input_specification: 'Dòng 1: số nguyên dương lẻ $N$. Dòng 2: $N$ số nguyên cách nhau bởi dấu cách.',
    output_specification: 'In ra giá trị của phần tử nằm chính giữa mảng.',
    constraints: '$1 \\le N \\le 10^5$ ($N$ lẻ), $|A_i| \\le 10^9$',
    sample_cases: [
      { input: '5\n10 20 99 40 50\n', output: '99\n', explanation: 'Phần tử ở giữa vị trí thứ 3 là 99.' }
    ],
    testcases: [
      { input: '5\n10 20 99 40 50\n', output: '99\n', sample: true },
      { input: '3\n1 7 3\n', output: '7\n', sample: false },
      { input: '1\n42\n', output: '42\n', sample: false }
    ]
  },
  'CPP-EX-03': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Rẽ nhánh', 'Xử lý ký tự'],
    description: 'Cho một ký tự chữ cái $c$. Hãy kiểm tra: Nếu $c$ là chữ in hoa, in ra "HOA". Nếu $c$ là chữ in thường, in ra "THUONG".',
    input_specification: 'Một ký tự chữ cái duy nhất $c$.',
    output_specification: 'In ra "HOA" hoặc "THUONG".',
    constraints: '$c \\in [\'A\'..\'Z\', \'a\'..\'z\']$',
    sample_cases: [
      { input: 'A\n', output: 'HOA\n', explanation: 'A là chữ hoa.' },
      { input: 'b\n', output: 'THUONG\n', explanation: 'b là chữ thường.' }
    ],
    testcases: [
      { input: 'A\n', output: 'HOA\n', sample: true },
      { input: 'b\n', output: 'THUONG\n', sample: true },
      { input: 'Z\n', output: 'HOA\n', sample: false },
      { input: 'y\n', output: 'THUONG\n', sample: false }
    ]
  },
  'CPP-EX-04': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Xử lý xâu', 'Bảng mã ASCII'],
    description: 'Cho một ký tự chữ cái $c$. Đổi $c$ thành chữ in thường nếu đang là chữ hoa, và đổi thành chữ in hoa nếu đang là chữ thường.',
    input_specification: 'Một ký tự $c$.',
    output_specification: 'In ra ký tự sau khi đổi.',
    constraints: '$c \\in [\'A\'..\'Z\', \'a\'..\'z\']$',
    sample_cases: [
      { input: 'M\n', output: 'm\n', explanation: 'M đổi thành m.' },
      { input: 'k\n', output: 'K\n', explanation: 'k đổi thành K.' }
    ],
    testcases: [
      { input: 'M\n', output: 'm\n', sample: true },
      { input: 'k\n', output: 'K\n', sample: true },
      { input: 'A\n', output: 'a\n', sample: false },
      { input: 'z\n', output: 'Z\n', sample: false }
    ]
  },
  'CPP-EX-05': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Vòng lặp', 'Số học'],
    description: 'Cho số nguyên dương $N$. Hãy in các chữ số của $N$ theo chiều ngược lại (từ phải sang trái), mỗi chữ số cách nhau bởi một dấu cách.',
    input_specification: 'Một số nguyên dương $N$.',
    output_specification: 'In ra các chữ số theo chiều ngược lại cách nhau bởi dấu cách.',
    constraints: '$1 \\le N \\le 10^9$',
    sample_cases: [
      { input: '12345\n', output: '5 4 3 2 1\n', explanation: 'In ngược 5 4 3 2 1.' }
    ],
    testcases: [
      { input: '12345\n', output: '5 4 3 2 1\n', sample: true },
      { input: '908\n', output: '8 0 9\n', sample: false },
      { input: '7\n', output: '7\n', sample: false }
    ]
  },
  'PY-EX-01': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Nhập xuất', 'Xử lý xâu', 'Cơ bản'],
    description: 'Một chiếc loa phát thanh cần lặp lại thông điệp 3 lần. Nhập vào một dòng văn bản $S$, hãy in ra dòng đó lặp lại đúng 3 lần, mỗi lần trên một dòng.',
    input_specification: 'Một dòng chứa chuỗi ký tự $S$.',
    output_specification: 'In ra 3 dòng, mỗi dòng chứa chuỗi $S$.',
    constraints: '$1 \\le |S| \\le 200$',
    sample_cases: [
      { input: 'Alo 1 2 3\n', output: 'Alo 1 2 3\nAlo 1 2 3\nAlo 1 2 3\n', explanation: 'Lặp lại 3 lần.' }
    ],
    testcases: [
      { input: 'Alo 1 2 3\n', output: 'Alo 1 2 3\nAlo 1 2 3\nAlo 1 2 3\n', sample: true },
      { input: 'Thong bao khan\n', output: 'Thong bao khan\nThong bao khan\nThong bao khan\n', sample: false }
    ]
  },
  'PY-EX-02': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Vòng lặp', 'Nhập xuất'],
    description: 'Chú quạ thông minh kêu $N$ lần. Cho số nguyên dương $N$, hãy in ra $N$ từ "QUAC" trên cùng một dòng, cách nhau bởi một khoảng trắng.',
    input_specification: 'Một số nguyên dương $N$.',
    output_specification: 'In ra $N$ từ "QUAC" cách nhau bởi dấu cách.',
    constraints: '$1 \\le N \\le 100$',
    sample_cases: [
      { input: '3\n', output: 'QUAC QUAC QUAC\n', explanation: 'Kêu 3 lần.' }
    ],
    testcases: [
      { input: '3\n', output: 'QUAC QUAC QUAC\n', sample: true },
      { input: '1\n', output: 'QUAC\n', sample: false },
      { input: '5\n', output: 'QUAC QUAC QUAC QUAC QUAC\n', sample: false }
    ]
  },
  'PY-EX-03': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Toán học', 'Cơ bản'],
    description: 'Một bạn học sinh hiện tại có số tuổi là $N$. Hãy tính và in ra số tuổi của bạn ấy sau 6 năm nữa.',
    input_specification: 'Một số nguyên dương $N$ là số tuổi hiện tại.',
    output_specification: 'In ra số tuổi sau 6 năm nữa.',
    constraints: '$1 \\le N \\le 100$',
    sample_cases: [
      { input: '12\n', output: '18\n', explanation: '12 + 6 = 18.' }
    ],
    testcases: [
      { input: '12\n', output: '18\n', sample: true },
      { input: '8\n', output: '14\n', sample: false },
      { input: '15\n', output: '21\n', sample: false }
    ]
  },
  'PY-EX-04': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Nhập xuất', 'Cơ bản'],
    description: 'Cho 4 số nguyên $a, b, c, d$ trên cùng một dòng. Hãy in ra 4 số đó theo thứ tự ngược lại: $d, c, b, a$ cách nhau bởi dấu cách.',
    input_specification: 'Bốn số nguyên $a, b, c, d$ cách nhau bởi dấu cách.',
    output_specification: 'In ra $d, c, b, a$ trên một dòng.',
    constraints: '$|a|, |b|, |c|, |d| \\le 10^9$',
    sample_cases: [
      { input: '1 5 9 13\n', output: '13 9 5 1\n', explanation: 'In theo chiều ngược lại.' }
    ],
    testcases: [
      { input: '1 5 9 13\n', output: '13 9 5 1\n', sample: true },
      { input: '0 0 1 2\n', output: '2 1 0 0\n', sample: false }
    ]
  },
  'PY-EX-05': {
    points: 5,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Rẽ nhánh', 'Cơ bản'],
    description: 'Nhập vào một số nguyên $g$: Nếu $g = 1$, in ra "Nam". Nếu $g = 0$, in ra "Nu". Nếu khác 0 và 1, in ra "Khong hop le".',
    input_specification: 'Một số nguyên $g$.',
    output_specification: 'In ra "Nam", "Nu" hoặc "Khong hop le".',
    constraints: '$-10^9 \\le g \\le 10^9$',
    sample_cases: [
      { input: '1\n', output: 'Nam\n', explanation: '1 là Nam.' },
      { input: '0\n', output: 'Nu\n', explanation: '0 là Nu.' }
    ],
    testcases: [
      { input: '1\n', output: 'Nam\n', sample: true },
      { input: '0\n', output: 'Nu\n', sample: true },
      { input: '2\n', output: 'Khong hop le\n', sample: false }
    ]
  },
  'PY11-EX-01': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Toán học', 'Chia nhóm'],
    description: 'Lớp học có $N$ bạn học sinh. Thầy giáo chia lớp thành các nhóm học tập, mỗi nhóm có đúng $K$ bạn. Hãy tính số nhóm chia được và số bạn học sinh bị dư ra.',
    input_specification: 'Hai số nguyên dương $N$ và $K$ ($K > 0$).',
    output_specification: 'In ra hai số: số nhóm và số học sinh dư, cách nhau bởi dấu cách.',
    constraints: '$1 \\le N, K \\le 10^9$',
    sample_cases: [
      { input: '25 4\n', output: '6 1\n', explanation: 'Chia được 6 nhóm, dư 1 bạn.' }
    ],
    testcases: [
      { input: '25 4\n', output: '6 1\n', sample: true },
      { input: '20 5\n', output: '4 0\n', sample: false },
      { input: '3 5\n', output: '0 3\n', sample: false }
    ]
  },
  'PY11-EX-02': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Toán học', 'Quy đổi'],
    description: 'Cho số ngày $N$. Hãy quy đổi $N$ ngày thành số tuần và số ngày lẻ (1 tuần có 7 ngày).',
    input_specification: 'Một số nguyên dương $N$.',
    output_specification: 'In ra số tuần và số ngày lẻ cách nhau bởi dấu cách.',
    constraints: '$1 \\le N \\le 10^9$',
    sample_cases: [
      { input: '17\n', output: '2 3\n', explanation: '17 ngày gồm 2 tuần và 3 ngày.' }
    ],
    testcases: [
      { input: '17\n', output: '2 3\n', sample: true },
      { input: '14\n', output: '2 0\n', sample: false },
      { input: '5\n', output: '0 5\n', sample: false }
    ]
  },
  'PY11-EX-03': {
    points: 10,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Thầy Phùng Đức',
    types: ['Toán học', 'Số thực'],
    description: 'Cho số thực dương $N$. Hãy tính căn bậc 3 của $N$ và in ra kết quả làm tròn đúng 2 chữ số thập phân.',
    input_specification: 'Một số thực dương $N$.',
    output_specification: 'In ra giá trị căn bậc 3 của $N$ làm tròn 2 chữ số thập phân.',
    constraints: '$0.001 \\le N \\le 10^9$',
    sample_cases: [
      { input: '27\n', output: '3.00\n', explanation: 'Căn bậc 3 của 27 là 3.00.' },
      { input: '10\n', output: '2.15\n', explanation: 'Căn bậc 3 của 10 xấp xỉ 2.1544 -> 2.15.' }
    ],
    testcases: [
      { input: '27\n', output: '3.00\n', sample: true },
      { input: '10\n', output: '2.15\n', sample: true },
      { input: '8\n', output: '2.00\n', sample: false }
    ]
  },
  '26TI-A': {
    points: 20,
    time_limit: '1.0s',
    memory_limit: '256M',
    author: 'Contest 26TI / Thầy Phùng Đức',
    types: ['Mảng', 'Khởi động Contest'],
    description: 'Bài mở màn kỳ thi Contest 26TI: Cho mảng gồm $N$ số nguyên. Hãy tính tổng tất cả các phần tử trong mảng.',
    input_specification: 'Dòng 1: số nguyên $N$. Dòng 2: $N$ số nguyên cách nhau bởi dấu cách.',
    output_specification: 'In ra một số nguyên duy nhất là tổng các phần tử của mảng.',
    constraints: '$1 \\le N \\le 10^5, |A_i| \\le 10^9$',
    sample_cases: [
      { input: '4\n1 2 3 4\n', output: '10\n', explanation: '1 + 2 + 3 + 4 = 10.' }
    ],
    testcases: [
      { input: '4\n1 2 3 4\n', output: '10\n', sample: true },
      { input: '3\n-5 10 20\n', output: '25\n', sample: false },
      { input: '1\n100\n', output: '100\n', sample: false }
    ]
  }
};

let updatedCount = 0;
data.problems = data.problems.map(p => {
  const meta = DMOJ_PROBLEMS_META[p.id];
  if (meta) {
    updatedCount++;
    return {
      ...p,
      points: meta.points || 10,
      time_limit: meta.time_limit || '1.0s',
      memory_limit: meta.memory_limit || '256M',
      author: meta.author || 'DMOJ / Thầy Phùng Đức',
      types: meta.types || [p.category || 'Cơ bản'],
      description: meta.description,
      input_specification: meta.input_specification,
      output_specification: meta.output_specification,
      constraints: meta.constraints,
      sample_cases: meta.sample_cases,
      testcases: meta.testcases || p.testcases || []
    };
  } else {
    // Fallback DMOJ structure for any other problems
    return {
      ...p,
      points: 10,
      time_limit: '1.0s',
      memory_limit: '256M',
      author: p.platform || 'Thầy Phùng Đức',
      types: [p.category || 'Cơ bản'],
      description: `Bài tập thuộc chuyên đề ${p.category || 'Thuật toán'}. Hãy giải quyết bài toán theo yêu cầu và tối ưu thuật toán.`,
      input_specification: 'Dữ liệu đầu vào theo định dạng chuẩn bài toán.',
      output_specification: 'In kết quả ra màn hình chuẩn (stdout).',
      constraints: 'Ràng buộc theo chuẩn bài thi.',
      sample_cases: [
        { input: '1 2\n', output: '3\n', explanation: 'Ví dụ mẫu.' }
      ]
    };
  }
});

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Successfully converted ${data.problems.length} problems to DMOJ structure (Enriched ${updatedCount} with rich specs)!`);
