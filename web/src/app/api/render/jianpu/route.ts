import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const _data = await request.json();

    // 1. 在此解析传入的 variant 数据 (_data.variant)，将其格式化为 Jianpu-ly 所需的输入文本格式
    // const jianpuSource = convertToJianpuLyData(data.variant);
    
    // 2. 调用命令行的 python3 jianpu-ly.py 和 lilypond (本地环境当前无，因此注释掉)
    // const { stdout } = await execAsync(`echo "${jianpuSource}" | python3 jianpu-ly.py | lilypond -o output -`);
    
    // 3. 读取生成的 svg 文件
    // const svgContent = fs.readFileSync('output.svg', 'utf-8');

    // MOCK 模拟返回一段左右手完整对齐的钢琴简谱 SVG 图片代码
    const mockSvg = `
      <svg width="600" height="200" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">
        <text x="20" y="30" font-family="sans-serif" font-size="16" font-weight="bold">1=C  4/4  (示例 Mock 对齐图片)</text>
        
        <!-- 大谱表起点的垂直连线 -->
        <line x1="20" y1="50" x2="20" y2="150" stroke="#000" stroke-width="2" />
        <path d="M 16 50 C 5 75, 5 125, 16 150" fill="transparent" stroke="#000" stroke-width="2" />
        
        <!-- 右手旋律 -->
        <text x="40" y="90" font-family="sans-serif" font-size="24">1  3  5  i </text>
        <circle cx="163" cy="65" r="2.5" fill="#000" />
        
        <text x="220" y="90" font-family="sans-serif" font-size="24">| i  b7  5  4</text>
        <circle cx="236" cy="65" r="2.5" fill="#000" />

        <text x="440" y="90" font-family="sans-serif" font-size="24">|</text>
        
        <!-- 左手旋律 -->
        <text x="40" y="150" font-family="sans-serif" font-size="24">1  -  -  - </text>
        <circle cx="48" cy="155" r="2.5" fill="#000" />

        <!-- 严格贯穿的小节线 -->
        <line x1="225" y1="50" x2="225" y2="150" stroke="#000" stroke-width="1" />
        

        <text x="220" y="150" font-family="sans-serif" font-size="24">| b6 -  -  -</text>
        <circle cx="266" cy="155" r="2.5" fill="#000" />
        <circle cx="266" cy="162" r="2.5" fill="#000" />
        
        <!-- 结束竖线 -->
        <line x1="445" y1="50" x2="445" y2="150" stroke="#000" stroke-width="2" />
      </svg>
    `;

    // 建议网络延迟以模拟实际打谱时长
    await new Promise(resolve => setTimeout(resolve, 800));

    // 返回图片
    return NextResponse.json({ svg: mockSvg });
  } catch (error) {
    console.error("Failed to render Jianpu:", error);
    return NextResponse.json({ error: "Failed to render Jianpu" }, { status: 500 });
  }
}
