import fs from 'fs';
import path from 'path';
// 로그 저장 경로 설정

export default function(){
    const logFilePath = path.join(process.cwd(), 'app.log');
    
    const originalLog = console.log;

    // 로그 출력 func
    // useLogFile(args);
    const useLogFile = (args)=>{
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Circular Object]';
                }
            }
            return String(arg);
        }).join(' ');
    
        // 타임스탬프 추가
        const timestamp = new Date().toLocaleString();
        const fullLog = `[${timestamp}] ${message}\n`;
    
        // 로그파일 저장
        fs.appendFile(logFilePath, fullLog, err => {
            if (err) originalLog('Error writing log file:', err);
        });
    }

    // console.log 재정의
    console.log = (...args)=>{
        if (false){
            // 기존 로그 출력
            originalLog(...args);
            // console.error("콘솔로그테스트", ...args);
        }
        
        if (true){
            // 로그 문자열로 변환
            useLogFile(args);
        }
    }

    // 커스텀 로그 함수 정의
    console.mine = (...args)=>{
        originalLog(...args);
    }
}