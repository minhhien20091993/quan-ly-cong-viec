"""Văn phòng AI hỗ trợ IT bệnh viện: 4 phòng, 12 agent, chạy song song theo từng giai đoạn.

Quy trình:  (đọc tệp đính kèm) -> Điều phối nhận diện loại việc -> Tiếp nhận -> Phân tích + Tìm kiếm (song song)
            -> Tổng hợp -> Biên soạn báo cáo theo loại việc -> xuất Word
Loại việc:  sự cố, thiết kế/lập kế hoạch, phân tích tài liệu, soạn văn bản, tư vấn chung
Tệp:        ảnh (png/jpg/gif/webp), PDF, Word (.docx), Excel (.xlsx), văn bản/log/cấu hình (.txt .log .csv .json ...)
Dữ liệu:    thư mục data/ (sessions/*.json lưu từng phiên, process.md là quy trình chung). Tệp gốc không được lưu lại.
Trao đổi:   mở lại phiên cũ để hỏi tiếp (kế thừa yêu cầu, báo cáo, ghi nhận các bộ phận), có thể cập nhật lại báo cáo.
Giao diện:  index.html + scene3d.js (cảnh 3D bằng Three.js; tự dùng cảnh 2D dự phòng nếu không tải được Three.js).
Cấu hình:   sao chép .env.example thành .env và điền ANTHROPIC_API_KEY
"""
import asyncio, base64, binascii, io, json, os, random, re, time
from contextvars import ContextVar
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request as URLRequest, urlopen

from dotenv import load_dotenv

BASE = Path(__file__).parent
load_dotenv(BASE / ".env")

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse

MODEL_LEAD = os.getenv("MODEL_LEAD", "claude-sonnet-5-5")    # điều phối, đọc tệp và biên soạn báo cáo
MODEL_AGENT = os.getenv("MODEL_AGENT", "claude-sonnet-5-5")  # các agent chuyên trách
WORKERS = int(os.getenv("WORKERS", "8"))
WEB_SEARCH = os.getenv("WEB_SEARCH", "0") == "1"
HOSPITAL = os.getenv("HOSPITAL_NAME", "").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
SUPABASE_SESSION_STORAGE = os.getenv("SUPABASE_SESSION_STORAGE", "0") == "1"

DATA = Path(os.getenv("DATA_DIR", str(BASE / "data"))).expanduser()
if not DATA.is_absolute():
    DATA = BASE / DATA
DATA = DATA.resolve()
(DATA / "sessions").mkdir(parents=True, exist_ok=True)
PROC_FILE = DATA / "process.md"

# ---------- giới hạn tệp đính kèm ----------
MAX_FILES = 6
MAX_TOTAL = 25 * 1024 * 1024
MAX_IMG = 5 * 1024 * 1024   # giới hạn ảnh của API
MAX_PDF = 10 * 1024 * 1024
MAX_TEXT_CHARS = 30000      # số ký tự tối đa lấy từ mỗi tệp văn bản/Word/Excel
TEXT_EXT = {".txt", ".log", ".csv", ".tsv", ".json", ".md", ".xml", ".ini", ".cfg", ".conf", ".yaml", ".yml",
            ".cmd", ".bat", ".ps1", ".sh", ".sql", ".rules"}
LEGACY_EXT = {".doc": ".docx", ".xls": ".xlsx", ".ppt": "PDF", ".pptx": "PDF"}

TEAMS = [
    {"id": "intake", "name": "Tiếp nhận yêu cầu"},
    {"id": "analysis", "name": "Phân tích"},
    {"id": "search", "name": "Tìm kiếm thông tin"},
    {"id": "synth", "name": "Tổng hợp"},
]
PHASES = [["intake"], ["analysis", "search"], ["synth"]]

# Giữ nguyên id để các phiên cũ vẫn xem lại được; tên và vai trò đã chuyển sang dạng dùng chung cho mọi loại việc.
_A = [
    ("classify", "Làm rõ yêu cầu", "intake", "làm rõ mục tiêu, phạm vi, bối cảnh và ràng buộc của yêu cầu, xác nhận loại việc đang cần làm"),
    ("urgency", "Ưu tiên & an toàn", "intake", "đánh giá mức ưu tiên, thời hạn hợp lý và ảnh hưởng đến an toàn người bệnh, hoạt động lâm sàng (nếu là sự cố thì dùng mức P1 đến P4)"),
    ("missing", "Thông tin cần thu thập", "intake", "liệt kê thông tin, số liệu, tài liệu, hình ảnh cần thu thập và nêu nên hỏi ai hoặc lấy ở đâu"),
    ("rootcause", "Phân tích chuyên môn", "analysis", "phân tích kỹ thuật chính của yêu cầu: giả thuyết nguyên nhân và cách kiểm tra (nếu là sự cố), phương án và kiến trúc (nếu là thiết kế), nhận xét có dẫn chứng (nếu là phân tích tài liệu)"),
    ("impact", "Tác động & nguồn lực", "analysis", "đánh giá tác động đến vận hành, nhân sự, chi phí, thời gian và đề xuất phương án tạm thời hoặc phương án dự phòng"),
    ("security", "Bảo mật & tuân thủ", "analysis", "đánh giá rủi ro bảo mật, quyền riêng tư dữ liệu bệnh nhân, yêu cầu tuân thủ quy định và dấu hiệu bất thường"),
    ("kb", "Giải pháp & thực tiễn tốt", "search", "nêu các giải pháp, cách làm phổ biến và thực tiễn tốt đã được kiểm chứng cho loại việc này"),
    ("docs", "Tài liệu & tiêu chuẩn", "search", "chỉ ra loại tài liệu, tiêu chuẩn, hướng dẫn nhà cung cấp hoặc quy định cần tra cứu kèm từ khóa tìm kiếm"),
    ("history", "Ví dụ tương tự", "search", "mô tả các trường hợp tương tự thường gặp trong bệnh viện và bài học rút ra"),
    ("plan", "Các bước thực hiện", "synth", "lập các bước thực hiện theo thứ tự, người phụ trách, thời gian dự kiến, kết quả cần đạt và điều kiện leo thang hoặc xin hỗ trợ"),
    ("reply", "Việc cần làm ngay & trao đổi", "synth", "nêu những việc cần làm ngay trong 1 đến 3 ngày đầu và soạn nội dung trao đổi ngắn gọn gửi người liên quan (nhân viên y tế, lãnh đạo hoặc nhà thầu)"),
    ("ticket", "Ghi nhận & cải tiến", "synth", "soạn nội dung ghi nhận (tiêu đề, mô tả, mức ưu tiên), tài liệu cần lưu và đề xuất cải tiến hoặc phòng ngừa cho lần sau"),
]
AGENTS = [dict(id=i, name=n, team=t, role=r) for i, n, t, r in _A]
TEAM_NAME = {t["id"]: t["name"] for t in TEAMS}

# ---------- loại việc ----------
TYPES = {
    "incident": ("Sự cố / hỗ trợ kỹ thuật", "báo lỗi, hỏng hóc, hệ thống chậm hoặc ngừng hoạt động cần khắc phục"),
    "design": ("Thiết kế / lập kế hoạch", "lập sơ đồ, thiết kế, kế hoạch triển khai, nâng cấp, lắp đặt hệ thống hoặc dự án"),
    "analysis": ("Phân tích tài liệu / dữ liệu", "đọc và đánh giá ảnh, log, cấu hình, bảng số liệu, tài liệu kỹ thuật được cung cấp"),
    "document": ("Soạn văn bản", "soạn đề xuất, quy trình, hướng dẫn, biên bản, thông báo hoặc văn bản khác"),
    "general": ("Tư vấn chung", "câu hỏi, tư vấn, so sánh phương án, kiến thức chuyên môn không thuộc các loại trên"),
}
DOC_TITLES = {
    "incident": "BÁO CÁO XỬ LÝ YÊU CẦU HỖ TRỢ IT",
    "design": "KẾ HOẠCH / ĐỀ XUẤT THIẾT KẾ",
    "analysis": "BÁO CÁO PHÂN TÍCH",
    "document": "BẢN THẢO VĂN BẢN VÀ HƯỚNG DẪN HOÀN THIỆN",
    "general": "BÁO CÁO TƯ VẤN HỖ TRỢ IT",
}
KEYWORDS = {
    "incident": ["lỗi", "không in", "không vào được", "mất mạng", "treo", "chậm", "sự cố", "hỏng", "không kết nối",
                 "không đăng nhập", "ngừng", "không hoạt động", "không mở được", "mất kết nối", "đứng máy", "bị khóa"],
    "design": ["sơ đồ", "thiết kế", "lập kế hoạch", "kế hoạch triển khai", "triển khai", "quy hoạch", "kiến trúc",
               "xây dựng hệ thống", "lắp đặt", "nâng cấp", "dự án", "cấu trúc mạng", "bố trí", "mô hình mạng"],
    "document": ["soạn", "viết văn bản", "đề xuất", "tờ trình", "biên bản", "hướng dẫn sử dụng", "công văn", "thông báo",
                 "mẫu văn bản", "viết quy trình"],
    "analysis": ["phân tích", "đọc log", "đánh giá", "xem giúp", "nhận xét", "so sánh", "kiểm tra giúp", "trong ảnh", "trong file"],
}


def guess_type(text, has_files=False):
    """Đoán loại việc bằng từ khóa. Chỉ dùng khi điều phối không trả về loại hợp lệ (hoặc ở chế độ demo)."""
    t = text.lower()
    score = {k: sum(w in t for w in ws) for k, ws in KEYWORDS.items()}
    best = max(score, key=score.get)
    if score[best] > 0:
        return best
    return "analysis" if has_files else "general"


DEFAULT_PROCESS = """# QUY TRÌNH HỖ TRỢ IT CHUNG (bản nháp, cần bổ sung)

## 1. Phạm vi
- Hỗ trợ IT cho bệnh viện: máy trạm, máy in, mạng, HIS/EMR, PACS/RIS/LIS, tài khoản người dùng, thiết bị y tế kết nối mạng.
- [CẦN BỔ SUNG] Tên bệnh viện, danh sách khoa/phòng, các hệ thống đang dùng (tên phần mềm, nhà cung cấp).

## 2. Mức ưu tiên (áp dụng cho sự cố)
- P1 Khẩn cấp: ảnh hưởng trực tiếp an toàn người bệnh hoặc làm ngừng hệ thống lâm sàng cốt lõi (cấp cứu, phòng mổ, hồi sức, HIS/PACS ngừng toàn viện). Xử lý ngay. [CẦN BỔ SUNG: thời gian phản hồi cam kết]
- P2 Cao: ảnh hưởng nhiều người dùng hoặc cả một khoa lâm sàng nhưng có phương án tạm thời.
- P3 Trung bình: ảnh hưởng một người dùng hoặc một thiết bị, không ảnh hưởng điều trị.
- P4 Thấp: yêu cầu cải tiến, hỗ trợ thông thường.

## 3. Các bước xử lý chuẩn (áp dụng cho sự cố)
1. Tiếp nhận: ghi nhận khoa/phòng, người báo, thiết bị, thời điểm, nội dung thông báo lỗi.
2. Phân loại và đánh giá mức ưu tiên.
3. Áp dụng phương án tạm thời để khoa tiếp tục hoạt động (máy thay thế, quy trình dự phòng bằng giấy).
4. Chẩn đoán và xử lý nguyên nhân gốc.
5. Xác nhận với người dùng, đóng yêu cầu, ghi nhận bài học kinh nghiệm.

## 4. Leo thang
- [CẦN BỔ SUNG] Người phụ trách theo từng nhóm hệ thống, số điện thoại trực, khi nào báo lãnh đạo hoặc nhà cung cấp.

## 5. Quy tắc bảo mật và dữ liệu bệnh nhân
- Không đưa dữ liệu định danh bệnh nhân vào công cụ AI.
- Không đính kèm tệp chứa mật khẩu, khóa bí mật hoặc cấu hình chưa xóa thông tin nhạy cảm.
- Nghi ngờ mã độc hoặc truy cập trái phép: cô lập thiết bị khỏi mạng và báo ngay bộ phận an ninh thông tin.
- [CẦN BỔ SUNG] Quy định nội bộ và pháp lý áp dụng tại bệnh viện.

## 6. Mẫu giao tiếp
- Phản hồi cho nhân viên y tế: ngắn gọn, ít thuật ngữ kỹ thuật, nêu rõ việc cần làm ngay và thời gian dự kiến.

## 7. Công việc không phải sự cố (thiết kế, kế hoạch, phân tích, soạn văn bản)
- [CẦN BỔ SUNG] Mẫu văn bản, quy chuẩn đặt tên thiết bị, chuẩn đánh số IP/VLAN, nhà cung cấp và hợp đồng đang áp dụng.
"""

COMMON_RULES = ("Yêu cầu chung: văn phong hành chính rõ ràng, viết lại hoàn toàn thay vì sao chép; loại bỏ ý lặp; "
                "thống nhất các nhận định giữa các nguồn; không bịa thông tin (số liệu, tên thiết bị, địa chỉ IP, đường dẫn, quy định), "
                "chỗ chưa chắc hoặc chưa có dữ liệu ghi [CẦN XÁC NHẬN]. Không dùng tiêu đề cấp 1. Chỉ trả về nội dung Markdown; "
                "bảng dùng cú pháp Markdown kèm dòng phân cách.")

REPORTS = {
    "incident": ("""Biên soạn báo cáo xử lý sự cố bằng Markdown với đúng các mục sau, theo thứ tự:
## 1. Tóm tắt điều hành
(2 đến 4 câu: sự cố là gì, mức ưu tiên, hướng xử lý chính)
## 2. Thông tin tiếp nhận và phân loại
(bảng hai cột "Hạng mục | Nội dung" gồm: Khoa/phòng, Loại sự cố, Mức ưu tiên kèm lý do, Tác động vận hành)
## 3. Phân tích nguyên nhân
(các giả thuyết theo thứ tự khả năng, kèm cách kiểm tra nhanh)
## 4. Rủi ro bảo mật và dữ liệu
## 5. Kế hoạch xử lý
(bảng "Bước | Hành động | Người phụ trách | Thời gian dự kiến | Điều kiện leo thang")
## 6. Phương án tạm thời cho khoa/phòng
## 7. Thông tin cần xác nhận thêm
## 8. Khuyến nghị phòng ngừa
## 9. Nội dung phản hồi gửi người dùng
""", 3200),
    "design": ("""Biên soạn báo cáo thiết kế / lập kế hoạch bằng Markdown với đúng các mục sau, theo thứ tự:
## 1. Tóm tắt điều hành
(2 đến 4 câu: mục tiêu, cách tiếp cận đề xuất, việc đầu tiên cần làm)
## 2. Mục tiêu, phạm vi và giả định
(bảng hai cột "Hạng mục | Nội dung"; nêu rõ các giả định đang dùng vì chưa có số liệu thực tế)
## 3. Thông tin cần thu thập
(bảng "Thông tin cần thu thập | Lấy từ đâu hoặc hỏi ai | Vì sao cần | Ưu tiên")
## 4. Đề xuất thiết kế sơ bộ
(mô tả kiến trúc tổng thể, sau đó chi tiết theo khu vực hoặc theo tầng. Nếu yêu cầu có sơ đồ, vẽ sơ đồ dạng văn bản trong khối mã ``` bằng ký tự ASCII, mỗi dòng tối đa 80 ký tự, dưới 40 dòng, kèm chú giải; ghi rõ đây là sơ đồ sơ bộ cần khảo sát hiện trường để xác nhận)
## 5. Các bước thực hiện
(bảng "Bước | Việc cần làm | Người phụ trách | Thời gian dự kiến | Kết quả cần đạt")
## 6. Rủi ro, an toàn và bảo mật
## 7. Nguồn lực và vật tư dự kiến
## 8. Câu hỏi cần xác nhận
## 9. Việc nên làm trong tuần đầu tiên
""", 4800),
    "analysis": ("""Biên soạn báo cáo phân tích bằng Markdown với đúng các mục sau, theo thứ tự:
## 1. Tóm tắt điều hành
(kết luận chính trong 2 đến 4 câu)
## 2. Tài liệu và dữ liệu đã xem xét
(bảng "Tài liệu | Nội dung chính | Hạn chế hoặc độ tin cậy")
## 3. Phát hiện chính
(đánh số, mỗi ý kèm bằng chứng lấy từ tài liệu)
## 4. Đánh giá mức độ nghiêm trọng
(bảng "Phát hiện | Mức độ | Ảnh hưởng")
## 5. Khuyến nghị và các bước tiếp theo
(bảng "Bước | Hành động | Người phụ trách | Thời gian dự kiến")
## 6. Thông tin còn thiếu cần xác nhận
## 7. Lưu ý bảo mật và dữ liệu
""", 3800),
    "document": ("""Biên soạn kết quả soạn văn bản bằng Markdown với đúng các mục sau, theo thứ tự:
## 1. Tóm tắt
(mục đích văn bản, đối tượng nhận, các điểm chính)
## 2. Bản thảo văn bản
(toàn văn văn bản hoàn chỉnh, sẵn sàng chỉnh sửa; chỗ cần điền ghi [CẦN BỔ SUNG: nội dung cần điền])
## 3. Thông tin cần bổ sung
## 4. Gợi ý hoàn thiện và các bước tiếp theo
""", 4500),
    "general": ("""Biên soạn báo cáo tư vấn bằng Markdown với đúng các mục sau, theo thứ tự:
## 1. Tóm tắt trả lời
(2 đến 4 câu)
## 2. Phân tích chi tiết
## 3. Việc nên làm và các bước thực hiện
(bảng "Bước | Việc cần làm | Người phụ trách | Thời gian dự kiến" nếu có nhiều bước)
## 4. Thông tin cần thu thập thêm
## 5. Rủi ro và lưu ý
## 6. Tài liệu nên tra cứu
(nêu loại tài liệu hoặc tiêu chuẩn, không bịa đường dẫn)
""", 3800),
}

READ_SYSTEM = ("Bạn là kỹ thuật viên IT bệnh viện đang đọc các tệp đính kèm để đồng nghiệp xử lý yêu cầu. "
               "Với mỗi tệp: cho biết đó là gì, chép lại chính xác các chi tiết kỹ thuật quan trọng (thông báo lỗi, tên thiết bị, "
               "số hiệu, địa chỉ IP, sơ đồ, số liệu, thời điểm), và nêu điều bất thường hoặc chỗ không đọc rõ. "
               "Tối đa 700 từ, tiếng Việt, không suy đoán thêm. Tuyệt đối không chép lại thông tin định danh bệnh nhân "
               "(tên, mã hồ sơ, ngày sinh, số điện thoại): thay bằng [ĐÃ ẨN]. Nếu tệp chứa mật khẩu hoặc khóa bí mật, "
               "không chép lại, chỉ ghi [ĐÃ ẨN] và cảnh báo người dùng.")

try:
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic() if os.getenv("ANTHROPIC_API_KEY") else None
except ImportError:
    client = None

app = FastAPI()
_jobs: set = set()
_queues: dict = {}
_locks: dict = {}   # mỗi phiên một khóa để các lượt trao đổi không ghi chồng lên nhau
_current_access_token = ContextVar("office_ai_access_token", default=None)


def _supabase_request(path: str, method: str, token: str, payload=None, extra_headers=None):
    """Xác minh phiên và quyền bằng access token của chính người dùng, không dùng service-role key."""
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = URLRequest(
        f"{SUPABASE_URL}{path}",
        data=body,
        method=method,
        headers={
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            **(extra_headers or {}),
        },
    )
    try:
        with urlopen(req, timeout=8) as response:
            return response.status, response.read()
    except HTTPError as exc:
        return exc.code, exc.read()
    except (URLError, TimeoutError):
        return 503, b"{}"


@app.middleware("http")
async def require_supabase_ai_access(request: Request, call_next):
    # Chỉ HTML, module 3D và cấu hình publishable được phục vụ trước đăng nhập.
    if request.url.path in {"/", "/auth-config", "/scene3d.js"} or request.url.path.startswith("/vendor/"):
        return await call_next(request)
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        return JSONResponse({"error": "Chưa cấu hình Supabase Auth cho Văn phòng AI."}, status_code=503)
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return JSONResponse({"error": "Cần đăng nhập bằng tài khoản Supabase."}, status_code=401)

    status, raw_access = await asyncio.to_thread(
        _supabase_request, "/rest/v1/rpc/can_use_office_ai", "POST", token.strip(), {}
    )
    if status in (401, 403):
        return JSONResponse({"error": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."}, status_code=401)
    if status != 200:
        return JSONResponse({"error": "Chưa kiểm tra được quyền Văn phòng AI. Hãy chạy migration quyền trong Supabase."}, status_code=503)
    if raw_access.strip().lower() != b"true":
        return JSONResponse({"error": "Tài khoản chưa được cấp quyền truy cập Văn phòng AI."}, status_code=403)
    context_token = _current_access_token.set(token.strip())
    try:
        return await call_next(request)
    finally:
        _current_access_token.reset(context_token)


# ---------- tệp đính kèm ----------
def decode_text(b: bytes) -> str:
    try:
        return b.decode("utf-8-sig")
    except UnicodeDecodeError:
        pass
    if b[:2] in (b"\xff\xfe", b"\xfe\xff"):
        try:
            return b.decode("utf-16")
        except UnicodeDecodeError:
            pass
    for enc in ("cp1258", "cp1252"):  # tệp tiếng Việt lưu từ Windows
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode("utf-8", errors="replace")


def docx_text(b: bytes) -> str:
    from docx import Document
    d = Document(io.BytesIO(b))
    parts = [p.text for p in d.paragraphs if p.text.strip()]
    for t in d.tables:
        for r in t.rows:
            parts.append(" | ".join(c.text.strip() for c in r.cells))
    return "\n".join(parts)


def xlsx_text(b: bytes) -> str:
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(b), read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets[:3]:
        out.append(f"## Sheet: {ws.title}")
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i >= 200:
                out.append("… (đã cắt, chỉ lấy 200 dòng đầu)")
                break
            out.append("\t".join("" if v is None else str(v) for v in row))
    return "\n".join(out)


def image_type(b: bytes):
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:4] == b"GIF8":
        return "image/gif"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    return None


def parse_attachments(raw):
    """Nhận danh sách {name, data(base64)} từ giao diện. Trả về (files, lỗi)."""
    if not raw:
        return [], ""
    if not isinstance(raw, list) or len(raw) > MAX_FILES:
        return [], f"Tối đa {MAX_FILES} tệp cho mỗi yêu cầu."
    files, total = [], 0
    for f in raw:
        if not isinstance(f, dict):
            return [], "Dữ liệu tệp không hợp lệ."
        name = os.path.basename(str(f.get("name") or "tep"))[:120] or "tep"
        try:
            data = base64.b64decode(f.get("data") or "")
        except (binascii.Error, ValueError):
            return [], f"Không đọc được tệp {name}."
        total += len(data)
        if total > MAX_TOTAL:
            return [], f"Tổng dung lượng tệp vượt {MAX_TOTAL // 1024 // 1024} MB."
        if not data:
            return [], f"Tệp {name} rỗng."
        ext = Path(name).suffix.lower()
        item = {"name": name, "size": len(data)}
        mt = image_type(data)
        try:
            if mt:
                if len(data) > MAX_IMG:
                    return [], f"Ảnh {name} lớn hơn 5 MB, hãy chụp lại nhỏ hơn hoặc cắt bớt."
                item.update(kind="image", media_type=mt, b64=base64.b64encode(data).decode())
            elif data[:4] == b"%PDF":
                if len(data) > MAX_PDF:
                    return [], f"PDF {name} lớn hơn 10 MB."
                item.update(kind="pdf", b64=base64.b64encode(data).decode())
            elif ext in LEGACY_EXT:
                return [], f"Chưa đọc được định dạng {ext}. Hãy lưu {name} sang {LEGACY_EXT[ext]} rồi đính kèm lại."
            elif ext == ".docx":
                item.update(kind="text", text=docx_text(data))
            elif ext in (".xlsx", ".xlsm"):
                item.update(kind="text", text=xlsx_text(data))
            elif ext in TEXT_EXT:
                item.update(kind="text", text=decode_text(data))
            else:
                return [], f"Chưa hỗ trợ định dạng của {name}. Dùng ảnh, PDF, Word (.docx), Excel (.xlsx) hoặc tệp văn bản."
        except Exception as e:
            return [], f"Không đọc được nội dung {name}: {e}"
        if item["kind"] == "text":
            item["text"] = item["text"].strip()
            if not item["text"]:
                return [], f"Tệp {name} không có nội dung chữ để đọc."
            if len(item["text"]) > MAX_TEXT_CHARS:
                item["text"] = item["text"][:MAX_TEXT_CHARS] + "\n… (đã cắt bớt do quá dài)"
        files.append(item)
    return files, ""


def file_blocks(files):
    blocks = []
    for f in files:
        blocks.append({"type": "text", "text": f"Tệp đính kèm: {f['name']}"})
        if f["kind"] == "image":
            blocks.append({"type": "image", "source": {"type": "base64", "media_type": f["media_type"], "data": f["b64"]}})
        elif f["kind"] == "pdf":
            blocks.append({"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": f["b64"]}})
        else:
            blocks.append({"type": "text", "text": f["text"]})
    return blocks


# ---------- quy trình chung & phiên ----------
def _session_db_request(path: str, method: str, payload=None):
    if not SUPABASE_SESSION_STORAGE:
        return None
    token = _current_access_token.get()
    if not token:
        raise RuntimeError("Không có phiên đăng nhập để truy cập dữ liệu Supabase.")
    headers = {"Prefer": "resolution=merge-duplicates,return=minimal"} if method == "POST" else {}
    status, raw = _supabase_request(path, method, token, payload, headers)
    if status >= 400:
        raise RuntimeError(f"Supabase từ chối thao tác lưu trữ (HTTP {status}). Hãy kiểm tra migration office_ai_storage.sql và quyền truy cập.")
    return raw


def process_text() -> str:
    if SUPABASE_SESSION_STORAGE:
        raw = _session_db_request("/rest/v1/office_ai_settings?id=eq.process&select=value&limit=1", "GET")
        rows = json.loads(raw or b"[]")
        if rows:
            return str((rows[0].get("value") or {}).get("text", DEFAULT_PROCESS))
        text = DEFAULT_PROCESS
        _session_db_request("/rest/v1/office_ai_settings?on_conflict=id", "POST", {
            "id": "process", "value": {"text": text}, "updated_at": datetime.now().isoformat(timespec="seconds")})
        return text
    if not PROC_FILE.exists():
        PROC_FILE.write_text(DEFAULT_PROCESS, encoding="utf-8")
    return PROC_FILE.read_text(encoding="utf-8")


def save_process(text: str):
    if SUPABASE_SESSION_STORAGE:
        _session_db_request("/rest/v1/office_ai_settings?on_conflict=id", "POST", {
            "id": "process", "value": {"text": text}, "updated_at": datetime.now().isoformat(timespec="seconds")})
        return
    PROC_FILE.write_text(text, encoding="utf-8")


def ctx_block() -> str:
    return ("Quy trình chung của bệnh viện (phải tuân thủ; mục ghi [CẦN BỔ SUNG] nghĩa là chưa có thông tin, "
            "không tự bịa):\n" + process_text()[:8000])


def att_block(digest: str) -> str:
    return f"\n\nNội dung các tệp đính kèm (đã được đọc và tóm lược):\n{digest}" if digest else ""


def spath(sid):
    return DATA / "sessions" / f"{sid}.json"


def save(s):
    if SUPABASE_SESSION_STORAGE:
        _session_db_request("/rest/v1/office_ai_sessions?on_conflict=id", "POST", {
            "id": s["id"], "session": s, "updated_at": datetime.now().isoformat(timespec="seconds")})
        return
    spath(s["id"]).write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8")


def load(sid):
    if not re.fullmatch(r"[\d-]+", sid):
        return None
    if SUPABASE_SESSION_STORAGE:
        raw = _session_db_request(f"/rest/v1/office_ai_sessions?id=eq.{sid}&select=session&limit=1", "GET")
        rows = json.loads(raw or b"[]")
        return rows[0].get("session") if rows else None
    if not spath(sid).exists():
        return None
    return json.loads(spath(sid).read_text(encoding="utf-8"))


def delete_session(sid):
    if SUPABASE_SESSION_STORAGE:
        _session_db_request(f"/rest/v1/office_ai_sessions?id=eq.{sid}", "DELETE")
        return
    if spath(sid).exists():
        spath(sid).unlink()


def list_sessions():
    if SUPABASE_SESSION_STORAGE:
        raw = _session_db_request("/rest/v1/office_ai_sessions?select=session&order=updated_at.desc", "GET")
        return [row.get("session") for row in json.loads(raw or b"[]") if isinstance(row.get("session"), dict)]
    out = []
    for f in sorted((DATA / "sessions").glob("*.json"), reverse=True):
        try:
            out.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            continue
    return out


def new_session(request_text):
    base = datetime.now().strftime("%Y%m%d-%H%M%S")
    sid = f"{base}-{random.randrange(10000, 100000)}"
    while load(sid):
        sid = f"{base}-{random.randrange(10000, 100000)}"
    return {"id": sid, "created": datetime.now().isoformat(timespec="seconds"), "request": request_text,
            "status": "running", "type": "", "type_label": "", "files": [], "digest": "",
            "tasks": {}, "results": {}, "report_md": "", "error": ""}


# ---------- gọi Claude ----------
async def ask(model, system, user, max_tokens=900, search=False):
    """user có thể là chuỗi hoặc danh sách khối nội dung (văn bản, ảnh, PDF)."""
    if client is None:  # chế độ demo, không gọi API
        await asyncio.sleep(random.uniform(1.5, 4))
        tail = user if isinstance(user, str) else next((b["text"] for b in reversed(user) if b.get("type") == "text"), "")
        return f"[Demo] Kết quả giả lập cho: {tail[-90:]}…\nĐiền ANTHROPIC_API_KEY vào file .env để chạy thật."
    kw = dict(model=model, max_tokens=max_tokens, system=system, messages=[{"role": "user", "content": user}])
    if search and WEB_SEARCH:
        try:
            r = await client.messages.create(**kw, tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}])
            return "".join(b.text for b in r.content if b.type == "text")
        except Exception:
            pass  # chưa bật web search thì chạy tiếp không tra web
    r = await client.messages.create(**kw)
    return "".join(b.text for b in r.content if b.type == "text")


async def read_files(request_text, files):
    """Một lượt gọi đọc toàn bộ tệp, trả về bản tóm lược để các agent dùng chung (tiết kiệm hơn gửi ảnh cho từng agent)."""
    if not files:
        return ""
    if client is None:
        await asyncio.sleep(1.5)
        return "[Demo] Đã nhận " + ", ".join(f["name"] for f in files) + ". Điền API key để hệ thống đọc nội dung thật."
    content = file_blocks(files) + [{"type": "text", "text": f"Yêu cầu của người dùng: {request_text}\n\nHãy đọc kỹ các tệp trên và tóm lược theo hướng dẫn."}]
    return await ask(MODEL_LEAD, READ_SYSTEM, content, max_tokens=2200)


async def plan(request_text, digest, has_files):
    roster = "\n".join(f'- {a["id"]}: {a["name"]} ({a["role"]})' for a in AGENTS)
    kinds = "\n".join(f"- {k}: {v[1]}" for k, v in TYPES.items())
    out = await ask(
        MODEL_LEAD,
        "Bạn là trưởng nhóm hỗ trợ IT của một bệnh viện. Chỉ trả về JSON hợp lệ, không giải thích.\n\n" + ctx_block(),
        f"Yêu cầu: {request_text}{att_block(digest)}\n\nCác loại việc:\n{kinds}\n\nDanh sách agent:\n{roster}\n\n"
        'Hãy chọn đúng một loại việc và giao nhiệm vụ cụ thể cho từng agent, sát với yêu cầu này (không chung chung). '
        'Trả về JSON dạng {"type": "incident|design|analysis|document|general", '
        '"tasks": {"id_agent": "nhiệm vụ cụ thể, một câu tiếng Việt"}} cho đủ tất cả agent.',
        max_tokens=2200,
    )
    m = re.search(r"\{.*\}", out, re.S)
    try:
        data = json.loads(m.group(0)) if m else {}
    except json.JSONDecodeError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    kind = data.get("type") if data.get("type") in TYPES else guess_type(request_text, has_files)
    tm = data.get("tasks") if isinstance(data.get("tasks"), dict) else data
    return kind, {a["id"]: str(tm.get(a["id"]) or a["role"]) for a in AGENTS}


async def orchestrate(request_text, files, emit, sess):
    digest = ""
    if files:
        await emit(type="status", text=f"Đang đọc {len(files)} tệp đính kèm…")
        digest = sess["digest"] = await read_files(request_text, files)
        await emit(type="digest", text=digest)
        save(sess)

    await emit(type="status", text="Điều phối đang nhận diện loại việc và lập kế hoạch…")
    kind, tasks = await plan(request_text, digest, bool(files))
    sess["type"], sess["type_label"], sess["tasks"] = kind, TYPES[kind][0], tasks
    await emit(type="kind", kind=kind, label=TYPES[kind][0])
    await emit(type="plan", tasks=tasks)
    save(sess)

    sem = asyncio.Semaphore(WORKERS)
    results = sess["results"]

    async def work(a, context):
        async with sem:
            await emit(type="agent_start", id=a["id"], task=tasks[a["id"]])
            t0, ok = time.time(), True
            try:
                out = await ask(
                    MODEL_AGENT,
                    f'Bạn là "{a["name"]}", chuyên {a["role"]}, thuộc phòng {TEAM_NAME[a["team"]]} '
                    "trong văn phòng ảo hỗ trợ công việc IT của một bệnh viện. Quy tắc: trả lời tiếng Việt, cụ thể, tối đa 200 từ; "
                    "ưu tiên an toàn người bệnh và tính liên tục của hệ thống lâm sàng; không yêu cầu hay nhắc "
                    "đến dữ liệu định danh bệnh nhân; nói rõ khi chưa chắc chắn; không bịa số liệu, tên thiết bị hay đường dẫn.\n\n"
                    + ctx_block(),
                    f"Yêu cầu: {request_text}\nLoại việc: {TYPES[kind][0]}{att_block(digest)}\n\nNhiệm vụ của bạn: {tasks[a['id']]}"
                    + (f"\n\nKết quả từ các phòng trước:\n{context}" if context else ""),
                    search=(a["team"] == "search"),
                )
            except Exception as e:  # một agent lỗi không làm sập cả hệ thống
                out, ok = f"Lỗi: {e}", False
            ms = int((time.time() - t0) * 1000)
            results[a["id"]] = {"name": a["name"], "team": a["team"], "output": out, "ok": ok, "ms": ms}
            await emit(type="agent_done", id=a["id"], output=out, ok=ok, ms=ms)

    for phase in PHASES:
        await emit(type="status", text="Phòng " + " + ".join(TEAM_NAME[t] for t in phase) + " đang làm việc…")
        context = "\n\n".join(f'## {a["name"]}\n{results[a["id"]]["output"]}' for a in AGENTS if a["id"] in results)
        await asyncio.gather(*(work(a, context) for a in AGENTS if a["team"] in phase))
        save(sess)

    await emit(type="status", text="Điều phối đang biên soạn báo cáo…")
    digest_all = "\n\n".join(f'## {a["name"]} ({TEAM_NAME[a["team"]]})\n{results[a["id"]]["output"]}' for a in AGENTS)
    spec, max_tok = REPORTS[kind]
    sess["report_md"] = await ask(
        MODEL_LEAD,
        "Bạn là trưởng nhóm hỗ trợ IT bệnh viện, đang biên soạn báo cáo chính thức từ ghi nhận của các bộ phận.\n\n" + ctx_block(),
        f"Yêu cầu gốc: {request_text}\nLoại việc: {TYPES[kind][0]}{att_block(digest)}\n\n"
        f"Ghi nhận từ các bộ phận:\n{digest_all}\n\n{spec}\n{COMMON_RULES}",
        max_tokens=max_tok,
    )
    sess["status"] = "done"
    await emit(type="final", text=sess["report_md"], id=sess["id"])


# ---------- trao đổi tiếp với phiên cũ ----------
MAX_CHAT_MSGS = 24       # số tin gần nhất đưa vào ngữ cảnh mỗi lượt
MAX_CHAT_INPUT = 8000    # độ dài tối đa một tin nhắn của người dùng

CHAT_SYSTEM = (
    "Bạn là trưởng nhóm hỗ trợ IT bệnh viện, đang tiếp tục trao đổi với người dùng về MỘT PHIÊN XỬ LÝ ĐÃ CÓ. "
    "Toàn bộ nội dung phiên (yêu cầu gốc, tóm lược tệp, báo cáo, ghi nhận của các bộ phận) nằm ở phần cuối; "
    "hãy kế thừa và bám sát nó, không hỏi lại điều phiên đã có. Khi người dùng cung cấp thông tin mới "
    "(kết quả kiểm tra, ảnh, log, phản hồi từ khoa/phòng), nêu rõ nhận định nào được xác nhận, nhận định nào thay đổi "
    "so với báo cáo cũ và việc cần làm tiếp theo. Nếu người dùng hỏi điều phiên chưa có, nói rõ là chưa có và đề xuất "
    "cách thu thập. Trả lời tiếng Việt, cụ thể, ngắn gọn (thường dưới 300 từ, trừ khi người dùng yêu cầu soạn dài), "
    "dùng Markdown đơn giản, không dùng tiêu đề cấp 1. Không bịa số liệu, tên thiết bị, địa chỉ IP, đường dẫn; "
    "chỗ chưa chắc ghi [CẦN XÁC NHẬN]. Ưu tiên an toàn người bệnh; không yêu cầu hay nhắc đến dữ liệu định danh bệnh nhân."
)


def _lock(sid):
    return _locks.setdefault(sid, asyncio.Lock())


def session_context(s) -> str:
    """Gom toàn bộ nội dung của phiên cũ để lượt trao đổi tiếp theo kế thừa."""
    kind = s.get("type") or "incident"
    parts = [f"Mã phiên: {s.get('id', '')}", f"Thời gian tiếp nhận: {s.get('created', '')}",
             f"Loại việc: {s.get('type_label') or TYPES.get(kind, TYPES['general'])[0]}",
             f"Yêu cầu gốc: {s.get('request', '')}"]
    if s.get("files"):
        parts.append("Tệp đính kèm lúc đầu (tệp gốc không còn được lưu): " + ", ".join(f.get("name", "") for f in s["files"]))
    if s.get("digest"):
        parts.append("Tóm lược tệp đính kèm:\n" + s["digest"][:8000])
    if s.get("report_md"):
        parts.append("Báo cáo hiện hành:\n" + s["report_md"][:16000])
    notes = []
    for a in AGENTS:
        r = (s.get("results") or {}).get(a["id"])
        if r and r.get("ok") and r.get("output"):
            notes.append(f"### {r.get('name', a['name'])}\n{r['output'][:1500]}")
    if notes:
        parts.append("Ghi nhận chi tiết của các bộ phận:\n" + "\n\n".join(notes))
    return "\n\n".join(parts)


def chat_messages(s, text, digest=""):
    """Lịch sử trao đổi của phiên + tin nhắn mới, theo đúng định dạng messages của API."""
    msgs = []
    for m in (s.get("chat") or [])[-MAX_CHAT_MSGS:]:
        t = m.get("text", "")
        if m.get("role") == "user" and m.get("digest"):
            t += "\n\n[Nội dung tệp đính kèm theo tin nhắn này, đã được đọc và tóm lược]\n" + m["digest"]
        msgs.append({"role": m["role"], "content": t})
    while msgs and msgs[0]["role"] != "user":  # lịch sử bị cắt giữa chừng thì bỏ tin lẻ đầu tiên
        msgs.pop(0)
    new = text + ("\n\n[Nội dung tệp đính kèm theo tin nhắn này, đã được đọc và tóm lược]\n" + digest if digest else "")
    msgs.append({"role": "user", "content": new})
    return msgs


def chat_public(s):
    return [{"role": m.get("role"), "text": m.get("text", ""), "time": m.get("time", ""), "files": m.get("files") or []}
            for m in (s.get("chat") or [])]


async def ask_chat(system, messages, max_tokens=2000):
    """Gọi Claude cho lượt trao đổi (nhiều lượt hỏi đáp). Phần ngữ cảnh phiên được đánh dấu cache để các lượt sau rẻ hơn."""
    if client is None:
        await asyncio.sleep(random.uniform(1, 2.5))
        return ("[Demo] Đây là câu trả lời giả lập cho phần trao đổi tiếp. Điền ANTHROPIC_API_KEY vào file .env để chạy thật.\n\n"
                "Bạn vừa hỏi: " + str(messages[-1]["content"])[:200])
    kw = dict(model=MODEL_LEAD, max_tokens=max_tokens, messages=messages,
              system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}])
    if WEB_SEARCH:
        try:
            r = await client.messages.create(**kw, tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}])
            return "".join(b.text for b in r.content if b.type == "text")
        except Exception:
            pass  # chưa bật web search thì trả lời không tra web
    r = await client.messages.create(**kw)
    return "".join(b.text for b in r.content if b.type == "text")


# ---------- xuất Word ----------
def build_docx(s, appendix=False) -> bytes:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    NAVY = RGBColor(0x1E, 0x3A, 0x8A)
    kind = s.get("type") or "incident"  # phiên cũ (trước khi có loại việc) đều là sự cố
    doc = Document()
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = Cm(2.2)
    sec.top_margin = sec.bottom_margin = Cm(2.0)

    def font(style, size, bold=False, color=None):
        f = style.font
        f.name, f.size, f.bold = "Calibri", Pt(size), bold
        if color:
            f.color.rgb = color
        style.element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Calibri")

    font(doc.styles["Normal"], 11)
    doc.styles["Footer"].font.size = Pt(8.5)
    doc.styles["Normal"].paragraph_format.space_after = Pt(6)
    for name, size, before in (("Heading 1", 16, 16), ("Heading 2", 13.5, 14), ("Heading 3", 12, 10)):
        st = doc.styles[name]
        font(st, size, True, NAVY)
        st.paragraph_format.space_before, st.paragraph_format.space_after = Pt(before), Pt(6)
        st.paragraph_format.keep_with_next = True

    def runs(par, text, size=None):
        for part in re.split(r"(\*\*[^*]+\*\*)", text):
            if len(part) > 4 and part.startswith("**") and part.endswith("**"):
                r = par.add_run(part[2:-2]); r.bold = True
            elif part:
                r = par.add_run(part)
            else:
                continue
            if size:
                r.font.size = Pt(size)

    def shade(cell, fill):
        pr = cell._tc.get_or_add_tcPr()
        sh = OxmlElement("w:shd")
        sh.set(qn("w:val"), "clear"); sh.set(qn("w:color"), "auto"); sh.set(qn("w:fill"), fill)
        pr.append(sh)

    def table(rows, widths=None, header=True):
        n = max(len(r) for r in rows)
        t = doc.add_table(rows=len(rows), cols=n)
        t.style = "Table Grid"
        if not widths:  # chia cột hợp lý: cột STT hẹp, bảng 2 cột thì cột đầu hẹp hơn
            total = 16.6
            if n == 2:
                widths = [4.5, total - 4.5]
            elif rows[0][0].lower() in ("bước", "stt", "#", "tt"):
                widths = [1.6] + [(total - 1.6) / (n - 1)] * (n - 1)
            else:
                widths = [total / n] * n
        t.autofit = False
        for j, w in enumerate(widths):
            t.columns[j].width = Cm(w)  # cập nhật cả lưới cột để Word và LibreOffice đều theo
        for i, r in enumerate(rows):
            for j in range(n):
                c = t.cell(i, j)
                c.text = ""
                runs(c.paragraphs[0], r[j] if j < len(r) else "", 10)
                c.paragraphs[0].paragraph_format.space_after = Pt(2)
                if header and i == 0:
                    for run in c.paragraphs[0].runs:
                        run.bold = True
                    shade(c, "DCE6F7")
                if widths:
                    c.width = Cm(widths[j])
        doc.add_paragraph().paragraph_format.space_after = Pt(2)

    def code_block(lines):  # khối mã / sơ đồ ASCII: một ô xám, chữ đơn cách
        t = doc.add_table(rows=1, cols=1)
        t.style = "Table Grid"
        c = t.cell(0, 0)
        shade(c, "F3F5F9")
        par = c.paragraphs[0]
        par.paragraph_format.space_after = Pt(0)
        for k, line in enumerate(lines):
            r = par.add_run(line if line else " ")
            r.font.name, r.font.size = "Consolas", Pt(8.5)
            r._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Consolas")
            if k < len(lines) - 1:
                r.add_break()
        doc.add_paragraph().paragraph_format.space_after = Pt(2)

    def md_to_docx(md):
        L, i = md.splitlines(), 0
        while i < len(L):
            ln = L[i].strip()
            if not ln:
                i += 1; continue
            if ln.startswith("```"):
                i += 1; code = []
                while i < len(L) and not L[i].strip().startswith("```"):
                    code.append(L[i].rstrip()); i += 1
                i += 1
                if code:
                    code_block(code)
                continue
            if ln.startswith("|"):
                rows = []
                while i < len(L) and L[i].strip().startswith("|"):
                    cells = [c.strip() for c in L[i].strip().strip("|").split("|")]
                    if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                        rows.append(cells)
                    i += 1
                if rows:
                    table(rows)
                continue
            m = re.match(r"(#{1,3})\s+(.*)", ln)
            if m:
                doc.add_heading(m.group(2).replace("**", ""), level=len(m.group(1)))
            elif re.match(r"[-*•]\s+", ln):
                runs(doc.add_paragraph(style="List Bullet"), re.sub(r"^[-*•]\s+", "", ln))
            elif re.match(r"\d+[.)]\s+", ln):
                p = doc.add_paragraph()
                p.paragraph_format.left_indent, p.paragraph_format.first_line_indent = Cm(0.9), Cm(-0.6)
                runs(p, ln)
            else:
                runs(doc.add_paragraph(), ln)
            i += 1

    # tiêu đề
    if HOSPITAL:
        p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(HOSPITAL.upper()); r.bold = True; r.font.size = Pt(12)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(DOC_TITLES.get(kind, DOC_TITLES["general"])); r.bold = True; r.font.size = Pt(20); r.font.color.rgb = NAVY
    p.paragraph_format.space_after = Pt(10)
    created = datetime.fromisoformat(s["created"]).strftime("%d/%m/%Y %H:%M")
    info = [["Mã phiên", s["id"]], ["Thời gian tiếp nhận", created]]
    if s.get("type_label"):
        info.append(["Loại yêu cầu", s["type_label"]])
    if s.get("files"):
        info.append(["Tệp đính kèm", ", ".join(f["name"] for f in s["files"])])
    info.append(["Yêu cầu gốc", s["request"]])
    table(info, widths=[4.2, 12.4], header=False)
    for row in doc.tables[0].rows:
        shade(row.cells[0], "EEF2FA")
        for run in row.cells[0].paragraphs[0].runs:
            run.bold = True

    md_to_docx(s.get("report_md") or "_Phiên này chưa có báo cáo tổng hợp._")

    if appendix and s.get("chat"):
        doc.add_page_break()
        doc.add_heading("Phụ lục: Trao đổi bổ sung sau báo cáo", level=1)
        for m in s["chat"]:
            who = "Người dùng" if m.get("role") == "user" else "Trưởng nhóm hỗ trợ IT"
            when = m.get("time", "")
            try:
                when = datetime.fromisoformat(when).strftime("%d/%m/%Y %H:%M")
            except ValueError:
                pass
            doc.add_heading(f"{who} · {when}".strip(" ·"), level=3)
            if m.get("files"):
                runs(doc.add_paragraph(), "**Tệp đính kèm:** " + ", ".join(m["files"]))
            md_to_docx(m.get("text", ""))

    if appendix and s.get("results"):
        doc.add_page_break()
        doc.add_heading("Phụ lục: Ghi nhận chi tiết của từng bộ phận", level=1)
        if s.get("digest"):
            doc.add_heading("Tóm lược tệp đính kèm", level=2)
            md_to_docx(s["digest"])
        for t in TEAMS:
            items = [a for a in AGENTS if a["team"] == t["id"] and a["id"] in s["results"]]
            if not items:
                continue
            doc.add_heading(f'Phòng {t["name"]}', level=2)
            for a in items:
                doc.add_heading(s["results"][a["id"]].get("name", a["name"]), level=3)
                md_to_docx(s["results"][a["id"]]["output"])

    # chân trang
    fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = fp.add_run("Báo cáo do hệ thống AI hỗ trợ soạn thảo, cần kỹ thuật viên xác nhận trước khi áp dụng · Trang ")
    r.font.size = Pt(8.5); r.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
    run = fp.add_run(); run.font.size = Pt(8.5)
    for kind_ in ("begin", "instr", "end"):
        if kind_ == "instr":
            el = OxmlElement("w:instrText"); el.set(qn("xml:space"), "preserve"); el.text = " PAGE "
        else:
            el = OxmlElement("w:fldChar"); el.set(qn("w:fldCharType"), kind_)
        run._r.append(el)

    buf = io.BytesIO(); doc.save(buf)
    return buf.getvalue()


# ---------- API ----------
@app.get("/")
async def index():
    return FileResponse(BASE / "index.html")


@app.get("/auth-config")
async def auth_config():
    # Đây là URL và publishable key dùng cho browser; tuyệt đối không trả secret/service-role key.
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        return JSONResponse({"configured": False})
    return {"configured": True, "url": SUPABASE_URL, "publishable_key": SUPABASE_PUBLISHABLE_KEY}


@app.get("/agents")
async def agents():
    return {"teams": TEAMS, "agents": [{k: a[k] for k in ("id", "name", "team")} for a in AGENTS],
            "workers": WORKERS, "demo": client is None, "hospital": HOSPITAL,
            "types": {k: v[0] for k, v in TYPES.items()},
            "limits": {"files": MAX_FILES, "total_mb": MAX_TOTAL // 1024 // 1024, "image_mb": MAX_IMG // 1024 // 1024}}


@app.get("/process")
async def get_process():
    return {"text": process_text()}


@app.put("/process")
async def put_process(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Dữ liệu gửi lên không hợp lệ."}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "Dữ liệu gửi lên phải là một đối tượng JSON."}, status_code=400)
    save_process(str(body.get("text", "")))
    return {"ok": True}


@app.get("/handoffs/{handoff_id}")
async def consume_task_handoff(handoff_id: str):
    """Đọc và tiêu thụ một phiếu công việc bằng đúng phiên Supabase của người dùng."""
    if not re.fullmatch(r"(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", handoff_id):
        return JSONResponse({"error": "Mã bàn giao không hợp lệ."}, status_code=400)
    token = _current_access_token.get()
    if not token:
        return JSONResponse({"error": "Cần đăng nhập để nhận công việc."}, status_code=401)
    status, raw = await asyncio.to_thread(
        _supabase_request,
        "/rest/v1/rpc/consume_office_ai_task_handoff",
        "POST",
        token,
        {"p_id": handoff_id},
    )
    if status != 200:
        return JSONResponse({
            "error": "Không nhận được công việc. Hãy kiểm tra migration office_ai_task_handoffs.sql trong Supabase."
        }, status_code=503 if status >= 500 else status)
    try:
        payload = json.loads(raw or b"null")
    except (json.JSONDecodeError, TypeError):
        payload = None
    if not isinstance(payload, dict):
        return JSONResponse({"error": "Phiếu đã được nhận, đã hết hạn hoặc không thuộc tài khoản này."}, status_code=404)
    return payload


@app.get("/sessions")
async def sessions():
    out = []
    for s in list_sessions():
        out.append({k: s.get(k) for k in ("id", "created", "request", "status", "type_label")}
                   | {"has_report": bool(s.get("report_md")), "nfiles": len(s.get("files") or []),
                      "nchat": len(s.get("chat") or []) // 2})
    return out


@app.get("/sessions/{sid}")
async def session_get(sid: str):
    s = load(sid)
    return s if s else JSONResponse({"error": "not found"}, status_code=404)


@app.delete("/sessions/{sid}")
async def session_delete(sid: str):
    if load(sid):
        delete_session(sid)
    _locks.pop(sid, None)
    return {"ok": True}


@app.get("/sessions/{sid}/docx")
async def session_docx(sid: str, appendix: int = 0):
    s = load(sid)
    if not s:
        return JSONResponse({"error": "not found"}, status_code=404)
    return Response(build_docx(s, bool(appendix)),
                    media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    headers={"Content-Disposition": f'attachment; filename="BaoCao_IT_{sid}.docx"'})


@app.post("/sessions/{sid}/chat")
async def session_chat(sid: str, request: Request):
    """Trao đổi tiếp với một phiên cũ: kế thừa toàn bộ nội dung phiên và lịch sử trao đổi trước đó."""
    if not load(sid):
        return JSONResponse({"error": "Không tìm thấy phiên này."}, status_code=404)
    if sid in _queues:
        return JSONResponse({"error": "Phiên đang được xử lý, hãy chờ hoàn tất rồi trao đổi tiếp."}, status_code=409)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Dữ liệu gửi lên không hợp lệ."}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "Dữ liệu gửi lên phải là một đối tượng JSON."}, status_code=400)
    text = str(body.get("message", "")).strip()
    if not text:
        return JSONResponse({"error": "Chưa nhập nội dung trao đổi."}, status_code=400)
    if len(text) > MAX_CHAT_INPUT:
        return JSONResponse({"error": f"Tin nhắn dài quá {MAX_CHAT_INPUT} ký tự, hãy rút gọn hoặc đính kèm thành tệp."}, status_code=400)
    files, err = parse_attachments(body.get("files"))
    if err:
        return JSONResponse({"error": err}, status_code=400)
    async with _lock(sid):
        s = load(sid)  # đọc lại trong khóa để có lịch sử mới nhất
        if not s:
            return JSONResponse({"error": "Không tìm thấy phiên này."}, status_code=404)
        try:
            digest = await read_files(text, files) if files else ""
            system = (CHAT_SYSTEM + "\n\n" + ctx_block() + "\n\n=== NỘI DUNG PHIÊN CŨ ===\n" + session_context(s))
            reply = (await ask_chat(system, chat_messages(s, text, digest))).strip()
            if not reply:
                raise RuntimeError("Mô hình không trả về nội dung.")
        except Exception as e:
            return JSONResponse({"error": f"Chưa trao đổi được: {e}"}, status_code=500)
        now = datetime.now().isoformat(timespec="seconds")
        chat = s.setdefault("chat", [])
        chat.append({"role": "user", "text": text, "time": now, "files": [f["name"] for f in files], "digest": digest})
        chat.append({"role": "assistant", "text": reply, "time": datetime.now().isoformat(timespec="seconds")})
        save(s)
        return {"chat": chat_public(s)}


@app.post("/sessions/{sid}/refine")
async def session_refine(sid: str):
    """Viết lại báo cáo của phiên có tính đến các trao đổi bổ sung. Bản cũ được giữ trong report_versions."""
    if not load(sid):
        return JSONResponse({"error": "Không tìm thấy phiên này."}, status_code=404)
    if sid in _queues:
        return JSONResponse({"error": "Phiên đang được xử lý, hãy chờ hoàn tất."}, status_code=409)
    if client is None:
        return JSONResponse({"error": "Chế độ demo (chưa có API key) nên chưa cập nhật được báo cáo."}, status_code=400)
    async with _lock(sid):
        s = load(sid)
        if not s:
            return JSONResponse({"error": "Không tìm thấy phiên này."}, status_code=404)
        chat = s.get("chat") or []
        start = min(int(s.get("refined_upto") or 0), len(chat))
        fresh = chat[start:]
        if not fresh:
            return JSONResponse({"error": "Chưa có trao đổi mới nào kể từ lần cập nhật báo cáo gần nhất."}, status_code=400)
        lines, used = [], 0
        for m in reversed(fresh):  # ưu tiên các trao đổi gần nhất nếu quá dài
            t = ("NGƯỜI DÙNG: " if m["role"] == "user" else "TRƯỞNG NHÓM: ") + m["text"]
            if m.get("digest"):
                t += "\n[Tóm lược tệp kèm theo]\n" + m["digest"]
            used += len(t)
            if used > 24000 and lines:
                break
            lines.append(t)
        transcript = "\n\n".join(reversed(lines))
        kind = s.get("type") if s.get("type") in REPORTS else "incident"
        spec, max_tok = REPORTS[kind]
        try:
            new_md = (await ask(
                MODEL_LEAD,
                "Bạn là trưởng nhóm hỗ trợ IT bệnh viện, đang CẬP NHẬT báo cáo chính thức sau khi trao đổi bổ sung với người dùng.\n\n" + ctx_block(),
                f"Nội dung phiên hiện tại:\n{session_context(s)}\n\nTrao đổi bổ sung chưa được đưa vào báo cáo:\n{transcript}\n\n"
                "Hãy viết lại báo cáo, giữ đúng cấu trúc bên dưới, đưa thông tin mới và các điều chỉnh vào những mục phù hợp, "
                "sửa các nhận định đã thay đổi, giữ nguyên phần vẫn đúng. Cuối báo cáo thêm mục \"## Cập nhật sau trao đổi\" "
                "gồm 2 đến 5 gạch đầu dòng nêu rõ điểm thay đổi so với bản trước.\n\n"
                f"{spec}\n{COMMON_RULES}",
                max_tokens=max_tok + 700,
            )).strip()
            if not new_md:
                raise RuntimeError("Mô hình không trả về nội dung.")
        except Exception as e:
            return JSONResponse({"error": f"Chưa cập nhật được báo cáo: {e}"}, status_code=500)
        if s.get("report_md"):
            s.setdefault("report_versions", []).append({"time": s.get("report_updated") or s.get("created"), "md": s["report_md"]})
        s["report_md"], s["status"] = new_md, "done"
        s["report_updated"] = datetime.now().isoformat(timespec="seconds")
        s["refined_upto"] = len(chat)
        save(s)
        return {"report_md": new_md, "updated": s["report_updated"]}


@app.get("/scene3d.js")
async def scene3d_js():
    return FileResponse(BASE / "scene3d.js", media_type="text/javascript", headers={"Cache-Control": "no-cache"})


@app.get("/vendor/{name}")
async def vendor_js(name: str):
    """Cho phép đặt sẵn three.module.js vào thư mục vendor/ để chạy khi máy không vào được Internet (CDN)."""
    p = BASE / "vendor" / name
    if not re.fullmatch(r"[\w.\-]+\.js", name) or not p.is_file():
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(p, media_type="text/javascript")


@app.post("/jobs")
async def create_job(request: Request):
    """Nhận yêu cầu (kèm tệp dạng base64), kiểm tra tệp, khởi chạy xử lý. Tiến độ lấy qua /stream/{id}."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Dữ liệu gửi lên không hợp lệ."}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "Dữ liệu gửi lên phải là một đối tượng JSON."}, status_code=400)
    goal = str(body.get("goal", "")).strip()
    if not goal:
        return JSONResponse({"error": "Chưa nhập yêu cầu."}, status_code=400)
    files, err = parse_attachments(body.get("files"))
    if err:
        return JSONResponse({"error": err}, status_code=400)

    sess = new_session(goal)
    sess["files"] = [{k: f[k] for k in ("name", "kind", "size")} for f in files]
    save(sess)
    # Mỗi SSE client có queue riêng; sự kiện được broadcast thay vì bị một tab lấy mất.
    stream_state = {"subscribers": set(), "events": []}
    _queues[sess["id"]] = stream_state

    async def emit(**e):
        e["event_id"] = len(stream_state["events"]) + 1
        stream_state["events"].append(e)
        for subscriber in tuple(stream_state["subscribers"]):
            subscriber.put_nowait(e)

    async def job():
        await emit(type="session", id=sess["id"])
        try:
            await orchestrate(goal, files, emit, sess)
        except Exception as ex:
            sess["status"], sess["error"] = "error", str(ex)
            await emit(type="error", message=str(ex))
        finally:
            save(sess)
            await emit(type="end")
            _queues.pop(sess["id"], None)

    t = asyncio.create_task(job())
    _jobs.add(t)
    t.add_done_callback(_jobs.discard)
    return {"id": sess["id"]}


@app.get("/stream/{sid}")
async def stream_job(sid: str, request: Request):
    state = _queues.get(sid)
    if state is None:
        return JSONResponse({"error": "not found"}, status_code=404)

    async def stream():
        q: asyncio.Queue = asyncio.Queue()
        state["subscribers"].add(q)
        try:
            # EventSource tự gửi Last-Event-ID khi kết nối lại; tab mới nhận lịch sử của lượt chạy.
            try:
                last_id = max(0, int(request.headers.get("last-event-id", "0")))
            except ValueError:
                last_id = 0
            for e in state["events"]:
                if e["event_id"] > last_id:
                    q.put_nowait(e)
            while True:
                e = await q.get()
                payload = json.dumps(e, ensure_ascii=False)
                yield f"id: {e['event_id']}\ndata: {payload}\n\n"
                if e["type"] == "end":
                    break
        finally:
            state["subscribers"].discard(q)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")))
