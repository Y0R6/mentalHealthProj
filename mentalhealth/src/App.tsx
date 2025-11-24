import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Type Definitions (สำหรับ Component Pages และ Core Functions) ---
interface SurveyResponses {
  q1: number; q2: number; q3: number; q4: number; q5: number;
}
interface ChatMessage {
    role: 'user' | 'assistant' | 'system'; 
    text: string;
}
interface SurveyResult {
    totalScore: number;
    riskLevel: string;
    timestamp: string;
}

// --- Global Variables / Mock Configs ---
const appId = 'local-mental-health-app-id'; 

// --- API Configuration (ใช้ KKU IntelSphere API และ GAS Proxy) ---
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyKOtQuw70YY0eMq4yfk95smUiNf0WsDnYtoX9LE_-2BCvqhkeowmyAT0bEp2CAOWUE0w/exec"; // ใช้ Proxy Path ที่ตั้งใน vite.config.ts

const KKU_API_BASE_URL: string = "https://gen.ai.kku.ac.th/api/v1";
const KKU_API_ENDPOINT: string = `${KKU_API_BASE_URL}/chat/completions`;
const KKU_API_KEY: string = "sk_3EVEEyaYdOzo0JpeqoJUZQ7Nf7C10AjS6Y30pf2JJOk36AFVw1WZl6GIda86lnMN"; 
const KKU_MODEL: string = "gemini-2.5-flash-lite";

// --- App Component ---
const App = () => {
  // State หลักสำหรับ Routing และ User Data
  const [stage, setStage] = useState<string>('home'); // home, survey, result, chatbot
  const [isChatbotOpen, setIsChatbotOpen] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false); 
  
  // State สำหรับ User/Session Management
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>(''); // สำหรับการลงทะเบียน
  // *** NEW STATE: สำหรับเก็บวันที่เข้าสู่ระบบล่าสุดจาก GAS ***
  const [lastRegistrationDate, setLastRegistrationDate] = useState<string | null>(null);
  
  // State สำหรับ Survey และ Result
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponses>({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
  const [latestResult, setLatestResult] = useState<SurveyResult | null>(null);
  const [hasTakenSurvey, setHasTakenSurvey] = useState<boolean>(false);
  
  // State สำหรับ Chatbot
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // State สำหรับ Feedbacks
  const [dataSaveStatus, setDataSaveStatus] = useState<string>('');
  const [loginStatus, setLoginStatus] = useState<string>('');

  // Refs สำหรับ Chatbot เพื่อ Auto-scroll และ Input Focus
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // 1. User ID Initialization (Mock GAS User)
  useEffect(() => {
    // กำหนด User ID แบบสุ่ม เนื่องจากไม่ได้ใช้ Firebase/Auth จริง
    setUserId('gas-user-' + Math.random().toString(36).substring(2, 9)); 
    setIsAuthReady(true);
  }, []);

  // 2. Chatbot Focus Fix
  useEffect(() => {
    if (isChatbotOpen && chatInputRef.current && !isLoading) {
      chatInputRef.current.focus();
    }
  }, [chatInput, isChatbotOpen, isLoading]); 
  
  // 3. Handle Survey Change (Function ถูกย้ายมาที่นี่)
  const handleSurveyChange = (qName: keyof SurveyResponses, value: number) => {
    setSurveyResponses(prev => ({ ...prev, [qName]: value }));
  };

  // 4. User Registration/Check (ส่งข้อมูลชื่อผู้ใช้ไป GAS และตรวจสอบสถานะ)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
        setLoginStatus('กรุณาใส่ชื่อของคุณเพื่อลงทะเบียน');
        return;
    }

    setLoginStatus('กำลังตรวจสอบและลงทะเบียน...');
    setLastRegistrationDate(null); // เคลียร์สถานะก่อนหน้า

    // 1. Prepare data for Check/Register action
    const registrationData = {
        userId: userId,
        name: userName.trim(),
        timestamp: new Date().toISOString(),
        action: 'CHECK_USER_OR_REGISTER', // Action ใหม่สำหรับ GAS
    };

     // *** เพิ่ม Log เพื่อดูข้อมูลที่ส่ง ***
    console.log("📤 Sending registration data:", registrationData);
    console.log("📍 To URL:", GAS_WEB_APP_URL);
    
    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(registrationData),
        });

        console.log("📥 Response status:", response.status);
        console.log("📥 Response ok:", response.ok);

        if (!response.ok) throw new Error(`GAS request failed with status ${response.status}`);

        // --- SIMULATE GAS RESPONSE ---
        // เนื่องจากเราไม่สามารถเขียน GAS script ได้ เราจะจำลองการตอบกลับของ GAS
        // ถ้า GAS พบชื่อนี้ จะตอบกลับสถานะ 'found' พร้อมเวลาล่าสุด
        // ถ้า GAS ไม่พบชื่อนี้ จะทำการบันทึกชื่อใหม่ แล้วตอบกลับสถานะ 'new'
        
        // ในการใช้งานจริง, Response จาก GAS ควรเป็น JSON ที่บอกสถานะ
        const result = await response.json(); 

        console.log("✅ Result from GAS:", result);
        
        const currentUserName = userName.trim();

        if (result.status === 'found' && result.name === currentUserName) {
            // Found: ผู้ใช้เดิม
            const lastSeenDate = new Date(result.lastSeen).toLocaleDateString('th-TH', { 
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            });
            setLoginStatus(`ยินดีต้อนรับกลับ คุณ ${currentUserName} (ID: ${userId})! เข้าสู่ระบบล่าสุดเมื่อ ${lastSeenDate}`);
            setLastRegistrationDate(result.lastSeen); // เก็บ last seen date
        } else if (result.status === 'new') {
            // New: ผู้ใช้ใหม่
            setLoginStatus(`ลงทะเบียนสำเร็จ: ${currentUserName} (ID: ${userId})`);
            setLastRegistrationDate(new Date().toISOString()); // ตั้งค่าเวลาปัจจุบันเป็นเวลาลงทะเบียน
        } else {
            // Unhandled scenario
            setLoginStatus(`ลงทะเบียน/เข้าสู่ระบบสำเร็จ: ${currentUserName}`);
            setLastRegistrationDate(new Date().toISOString());
        }
        
        // ไปยังหน้าแบบสอบถามทันทีหลังลงทะเบียน/เข้าสู่ระบบ
        setStage('survey'); 

    } catch (error) {
        setLoginStatus('การลงทะเบียน/ตรวจสอบล้มเหลว: การเชื่อมต่อมีปัญหา');
        console.error("Registration Error:", error);
    }
  };

  // 5. Process Survey and Save Data
  const submitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
      
    // คำนวณคะแนนรวม
    const totalScore = Object.values(surveyResponses).reduce((sum, current) => sum + current, 0);

    // กำหนดระดับความเสี่ยง
    let level: string;
    if (totalScore >= 5 && totalScore <= 10) {
      level = 'Low';
    } else if (totalScore <= 18) {
      level = 'Medium';
    } else {
      level = 'High';
    }
    
    const newResult: SurveyResult = {
        totalScore: totalScore,
        riskLevel: level,
        timestamp: new Date().toISOString(),
    };

    setLatestResult(newResult);
    setHasTakenSurvey(true); // ตั้งค่าว่าเคยทำแล้ว

    // สร้าง Object ข้อมูลที่พร้อมส่ง
    const surveyData = {
        userId: userId || 'anonymous-gas',
        timestamp: newResult.timestamp,
        appId: appId,
        survey: surveyResponses,
        totalScore: totalScore,
        riskLevel: level,
        userName: userName, // ส่งชื่อผู้ใช้ไปด้วย
        action: 'SUBMIT_SURVEY',
    };
    
    // --- Google Apps Script / Google Sheet Saving (ใช้ Proxy) ---
    if (!GAS_WEB_APP_URL.startsWith("https://script.google.com/macros/s/AKfycbxe287xK-Kz8IFz8oBRZ_B18iXAFkBNPFAY81G-gS2ehGqsp_ioa3GIoJhS8ifhCeXuKA/exec")) {
        setDataSaveStatus('บันทึกข้อมูลล้มเหลว: GAS Web App URL ไม่ถูกต้อง');
    } else {
        try {
            await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify(surveyData),
            });
            setDataSaveStatus('บันทึกผลสำรวจสำเร็จ (Google Sheet)');
        } catch (error) {
            console.error("Error sending data to Google Apps Script:", error);
            setDataSaveStatus('บันทึกข้อมูลล้มเหลว (การเชื่อมต่อล้มเหลว)');
        }
    }
    
    // ไปยังหน้าผลลัพธ์
    setStage('result');
  };

  // 6. Handle Chatbot interaction: จัดการการสนทนากับ AI
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;

    const userMessage: string = chatInput.trim();
    setIsLoading(true);

    const systemInstruction: { role: string, content: string } = {
      role: "system",
      content: `คุณคือ AI Chatbot ผู้ให้การสนับสนุนด้านสุขภาพจิตที่เป็นมิตร มีความเห็นอกเห็นใจ และไม่ตัดสิน บทบาทของคุณคือการให้ข้อมูล การให้กำลังใจ และเสนอเทคนิคการจัดการความเครียด/อารมณ์ในเบื้องต้นเท่านั้น **คำตอบของคุณต้องสั้น กระชับ และตรงประเด็น ไม่เกิน 3-4 ประโยคหลัก** ห้ามวินิจฉัยโรค ห้ามให้คำแนะนำทางการแพทย์ที่เฉพาะเจาะจง **และห้ามตอบคำถามเกี่ยวกับความเสี่ยงด้านธุรกิจ การเงิน หรือการลงทุนใดๆ เด็ดขาด** หากผู้ใช้ต้องการความช่วยเหลือเร่งด่วน ให้แนะนำพวกเขาให้ติดต่อผู้เชี่ยวชาญหรือสายด่วนสุขภาพจิตทันที. ตอบเป็นภาษาไทยเท่านั้น`
    };

    // เตรียม Messages สำหรับ API Call
    const messagesToSend = [
      systemInstruction,
      ...chatHistory.map(msg => ({ 
        role: msg.role === 'assistant' ? 'assistant' : 'user', 
        content: msg.text 
      })),
      { role: "user", content: userMessage }
    ];

    const newChatHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', text: userMessage }
    ];
    setChatHistory(newChatHistory);
    
    setChatInput(''); 

    try {
      const payload = {
        messages: messagesToSend,
        model: KKU_MODEL,
        stream: false,
        max_tokens: 150, // จำกัดความยาวของคำตอบ
      };

      let response: Response = await fetch(KKU_API_ENDPOINT, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${KKU_API_KEY}` // ส่ง API Key ใน Header
          },
          body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const result = await response.json();
      const modelText: string = result.choices?.[0]?.message?.content || "ขออภัยค่ะ มีข้อผิดพลาดในการตอบกลับจาก AI";
      
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', text: modelText } 
      ]);

    } catch (error) {
      console.error("Chatbot Error:", error);
      const errMsg = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', text: "เกิดข้อผิดพลาดในการเชื่อมต่อ (Console: " + errMsg + ")" }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Educational Content based on Risk Level (Low Contrast UI)
  const getContent = useCallback((riskLevel: string) => {
    switch (riskLevel) {
      case 'Low':
        return {
          title: "ยอดเยี่ยม! สุขภาพจิตดีเยี่ยม",
          advice: "คุณมีการจัดการอารมณ์ที่ดีและมีเครือข่ายสนับสนุนที่แข็งแกร่ง รักษาความสมดุลนี้ไว้ด้วยการออกกำลังกายสม่ำเสมอ การฝึกสติ (Mindfulness) และการพักผ่อนที่เพียงพอ",
          color: "bg-green-100 border-green-500 text-green-700"
        };
      case 'Medium':
        return {
          title: "ต้องใส่ใจเป็นพิเศษ",
          advice: "คุณอาจกำลังเผชิญกับความเครียดบ้าง ลองจัดเวลาพักผ่อนให้มากขึ้น ฝึกเทคนิคการหายใจ การเขียนบันทึกความรู้สึก (Journaling) และอย่าลังเลที่จะพูดคุยกับเพื่อนหรือผู้เชี่ยวชาญหากรู้สึกแย่ลง",
          color: "bg-orange-100 border-orange-400 text-orange-800"
        };
      case 'High':
        return {
          title: "ควรปรึกษาผู้เชี่ยวชาญ",
          advice: "คะแนนของคุณบ่งชี้ว่าคุณอาจต้องการความช่วยเหลือจากผู้เชี่ยวชาญด้านสุขภาพจิตอย่างเร่งด่วน กรุณาติดต่อสายด่วนสุขภาพจิตหรือผู้ให้บริการด้านสุขภาพเพื่อรับการประเมินและการสนับสนุนที่เหมาะสม",
          color: "bg-red-100 border-red-500 text-red-700"
        };
      default:
        return { title: "ผลการประเมิน", advice: "", color: "bg-gray-100 border-gray-300" };
    }
  }, []);
  
  // 8. Routing Logic (ใช้ฟังก์ชันที่กำหนดใน Component Pages)
  const renderPage = (props: any) => {
      // เรียกใช้ฟังก์ชัน Routing ที่จะถูกกำหนดในส่วน Component Pages
      if (typeof (window as any)._renderPageLogic === 'function') {
          return (window as any)._renderPageLogic(props);
      }
      return <div className="text-center p-8 text-red-500 font-semibold">ERROR: Routing Logic Not Found.</div>
  };

  // 9. Main Render Logic
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center p-4 md:p-8">
      {/* Navigation Header สำหรับ Desktop (Low Contrast UI) */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-md z-10 hidden md:flex justify-center">
        <div className="max-w-4xl w-full p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-900">Mental Health App</h1>
          <nav className="flex space-x-4">
            <button className={`bg-indigo-600 text-white-600 hover:text-white-700 font-medium ${stage === 'home' && 'text-indigo-200'}`} onClick={() => setStage('home')}>หน้าหลัก</button>
            <button className={`bg-indigo-600 text-white-600 hover:text-white-700 font-medium ${stage.includes('survey') && 'text-indigo-200'}`} onClick={() => setStage('survey')}>แบบสอบถาม</button>
            <button className={`bg-indigo-600 text-white-600 hover:text-white-700 font-medium ${stage === 'result' && 'text-indigo-200'}`} onClick={() => setStage('result')}>ผลลัพธ์</button>
            <button className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-4 py-2 rounded-xl transition shadow-md" onClick={() => setIsChatbotOpen(true)}>AI Chatbot</button>
          </nav>
        </div>
      </header>

      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-6 md:p-10 mt-16 mb-20">
        {!isAuthReady ? (
            <div className="text-center p-8 text-indigo-700 font-semibold">กำลังเชื่อมต่อระบบ...</div>
        ) : (
            renderPage({ 
                stage, hasTakenSurvey, latestResult, setStage, submitSurvey, surveyResponses, handleSurveyChange, userName, setUserName, handleRegister, loginStatus, dataSaveStatus, getContent, setIsChatbotOpen, userId, lastRegistrationDate
            })
        )}
      </div>

      {/* Chatbot Modal */}
      {/* Note: ChatbotModal Component อยู่ในส่วน AppPages.tsx */}
      {isChatbotOpen && (
        <ChatbotModal 
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
          chatHistory={chatHistory}
          chatInput={chatInput}
          setChatInput={setChatInput}
          handleChatSubmit={handleChatSubmit}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
          chatInputRef={chatInputRef}
        />
      )}
      
      {/* Navigation Bar สำหรับ Mobile (Fixed Bottom) (Light Theme UI) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-xl p-3 flex justify-around md:hidden z-10 border-t border-gray-200">
        <button className="text-indigo-700 hover:bg-gray-100 px-3 py-1 rounded-lg transition" onClick={() => setStage('home')}>หน้าหลัก</button>
        <button className="text-indigo-700 hover:bg-gray-100 px-3 py-1 rounded-lg transition" onClick={() => setStage('survey')}>แบบสอบถาม</button>
        <button className="text-indigo-700 hover:bg-gray-100 px-3 py-1 rounded-lg transition" onClick={() => setStage('result')}>ผลลัพธ์</button>
        <button className="text-white bg-teal-600 hover:bg-teal-500 px-3 py-1 rounded-lg transition" onClick={() => setIsChatbotOpen(true)}>AI Chat</button>
      </nav>
    </div>
  );
};
// --- Type Definitions (ต้องซ้ำในไฟล์นี้เพื่อให้ VS Code ไม่แจ้งเตือน) ---
interface SurveyResponses {
  q1: number; q2: number; q3: number; q4: number; q5: number;
}
interface ChatMessage {
    role: 'user' | 'assistant' | 'system'; 
    text: string;
}
interface SurveyResult {
    totalScore: number;
    riskLevel: string;
    timestamp: string;
}
interface AppProps {
    stage: string; hasTakenSurvey: boolean; latestResult: SurveyResult | null; setStage: (stage: string) => void; submitSurvey: (e: React.FormEvent) => Promise<void>; surveyResponses: SurveyResponses; handleSurveyChange: (qName: keyof SurveyResponses, value: number) => void; userName: string; setUserName: (name: string) => void; handleRegister: (e: React.FormEvent) => Promise<void>; loginStatus: string; dataSaveStatus: string; getContent: (riskLevel: string) => { title: string; advice: string; color: string }; setIsChatbotOpen: (open: boolean) => void;
    // *** NEW PROPS: สำหรับแสดงสถานะผู้ใช้ ***
    userId: string | null;
    lastRegistrationDate: string | null;
}


// 1. Survey Question Sub-Component 
const SurveyQuestion = ({ qName, question, value, onChange }: { qName: keyof SurveyResponses, question: string, value: number, onChange: (qName: keyof SurveyResponses, value: number) => void }) => (
    <div className="mb-4 p-4 border border-gray-200 rounded-xl shadow-sm bg-gray-50">
      <p className="font-semibold text-gray-700 mb-3">{question}</p>
      <div className="flex justify-between items-center gap-2 mt-2">
        {[1, 2, 3, 4, 5].map((score: number) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(qName, score)}
            // ปรับสีปุ่มให้สว่างขึ้น: ใช้ bg-indigo-500
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200
                      ${value === score ? 'bg-indigo-500 text-white shadow-md ring-2 ring-indigo-300' : 'bg-gray-200 text-gray-700 hover:bg-indigo-100'}`}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
        <span>ไม่เคยเลย (1)</span>
        <span>เป็นประจำ (5)</span>
      </div>
    </div>
);

// 2. Home/Login Page Component (Low Contrast UI)
const HomePage = ({ userName, setUserName, handleRegister, loginStatus, setIsChatbotOpen, userId, lastRegistrationDate }: Pick<AppProps, 'userName' | 'setUserName' | 'handleRegister' | 'loginStatus' | 'setIsChatbotOpen' | 'userId' | 'lastRegistrationDate'>) => {
    const formattedLastSeen = lastRegistrationDate 
        ? new Date(lastRegistrationDate).toLocaleDateString('th-TH', { 
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          })
        : null;

    return (
        <div className="text-center p-8">
            <h1 className="text-4xl font-bold text-indigo-800 mb-4">Web App ถามตอบปัญหาสุขภาพจิต</h1>
            <p className="text-gray-600 mb-8">กรุณาลงทะเบียนหรือกรอกชื่อเดิมเพื่อเข้าสู่ระบบ</p>
            
            <form onSubmit={handleRegister} className="flex flex-col gap-4 max-w-sm mx-auto">
                <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="ใส่ชื่อของคุณเพื่อลงทะเบียน/เข้าสู่ระบบ"
                    // ปรับ Input field เป็นสีขาว/เทาอ่อน และใช้ ring สี Indigo
                    className="p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 text-gray-800"
                />
                <button
                    type="submit"
                    // ปุ่มเน้นสี Indigo สว่างขึ้น
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-md transition duration-300"
                >
                    ลงทะเบียน / เข้าสู่ระบบ
                </button>
            </form>

            {/* แสดงสถานะการเข้าสู่ระบบ/ลงทะเบียน */}
            {loginStatus && (
                <div className="mt-4 p-3 bg-indigo-50 rounded-xl max-w-md mx-auto border-l-4 border-indigo-500">
                    <p className={`text-sm font-medium text-indigo-800`}>
                        {loginStatus}
                    </p>
                    {formattedLastSeen && (
                        <p className="text-xs text-gray-500 mt-1">
                            {/* แสดงเวลาล่าสุดเมื่อพบผู้ใช้เดิม */}
                            เข้าสู่ระบบ/ลงทะเบียนครั้งล่าสุด: {formattedLastSeen}
                        </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                        รหัสผู้ใช้ (ID): {userId}
                    </p>
                </div>
            )}

            <button 
                onClick={() => setIsChatbotOpen(true)}
                // ปุ่ม Chat ใช้สี Teal ที่ดูสะอาด
                className="mt-6 bg-teal-500 hover:bg-teal-600 text-white font-medium py-2 px-4 rounded-xl transition shadow-md"
            >
                ทดลองใช้ AI Chat
            </button>
        </div>
    );
};

// 3. Survey Page Component
const SurveyPage = ({ hasTakenSurvey, latestResult, setStage, submitSurvey, surveyResponses, handleSurveyChange, setIsChatbotOpen }: Pick<AppProps, 'hasTakenSurvey' | 'latestResult' | 'setStage' | 'submitSurvey' | 'surveyResponses' | 'handleSurveyChange' | 'setIsChatbotOpen'>) => {
    
    if (hasTakenSurvey && latestResult && latestResult.timestamp !== undefined) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-3xl font-bold text-indigo-800 mb-4">สถานะแบบสอบถาม</h2>
                <p className="text-lg text-gray-700 mb-4">
                    คุณเคยทำแบบสอบถามครั้งล่าสุดเมื่อ: {new Date(latestResult.timestamp).toLocaleDateString()}
                    <br/>
                    ระดับความเสี่ยงล่าสุด: <span className="font-extrabold text-lg text-orange-600">{latestResult.riskLevel}</span>
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                    <button
                        onClick={() => setStage('result')}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition"
                    >
                        ดูผลลัพธ์
                    </button>
                    <button
                        onClick={() => setStage('survey_new')} // เปลี่ยน Stage เพื่อแสดง Form ใหม่
                        className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition"
                    >
                        ทำแบบสอบถามใหม่
                    </button>
                </div>
                <button 
                    onClick={() => setIsChatbotOpen(true)}
                    className="mt-6 bg-teal-500 hover:bg-teal-600 text-white font-medium py-2 px-4 rounded-xl transition shadow-md"
                >
                    เปิด AI Chat
                </button>
            </div>
        );
    }
    
    return (
        <div className="p-8">
            <h2 className="text-3xl font-semibold text-indigo-800 mb-6">แบบสอบถามสุขภาพจิตเบื้องต้น (เลือกคะแนน 1-5)</h2>
            <form onSubmit={submitSurvey}>
                <SurveyQuestion qName="q1" question="1. ในช่วง 2 สัปดาห์ที่ผ่านมา คุณรู้สึกเศร้าหรือหมดหวังบ่อยแค่ไหน" value={surveyResponses.q1} onChange={handleSurveyChange} />
                <SurveyQuestion qName="q2" question="2. ในช่วง 2 สัปดาห์ที่ผ่านมา คุณมีความสนใจหรือความสุขในการทำสิ่งต่างๆ น้อยลงหรือไม่" value={surveyResponses.q2} onChange={handleSurveyChange} />
                <SurveyQuestion qName="q3" question="3. ในช่วง 2 สัปดาห์ที่ผ่านมา คุณรู้สึกเหนื่อยล้าหรือไม่มีเรี่ยวแรงหรือไม่" value={surveyResponses.q3} onChange={handleSurveyChange} />
                <SurveyQuestion qName="q4" question="4. ในช่วง 2 สัปดาห์ที่ผ่านมา คุณมีความกังวลหรือรู้สึกกระวนกระวายใจบ่อยแค่ไหน" value={surveyResponses.q4} onChange={handleSurveyChange} />
                <SurveyQuestion qName="q5" question="5. ในช่วง 2 สัปดาห์ที่ผ่านมา คุณนอนหลับยากหรือนอนมากเกินไปหรือไม่" value={surveyResponses.q5} onChange={handleSurveyChange} />
                <button
                    type="submit"
                    className="w-full bg-indigo-700 hover:bg-indigo-600 text-white font-semibold py-3 mt-4 rounded-xl shadow-md transition duration-300"
                >
                    ส่งแบบสอบถามและดูผล
                </button>
            </form>
             <button 
                onClick={() => setIsChatbotOpen(true)}
                className="mt-6 bg-teal-500 hover:bg-teal-600 text-white font-medium py-2 px-4 rounded-xl transition shadow-md"
            >
                เปิด AI Chat
            </button>
        </div>
    );
};

// 4. Result Page Component
const ResultPage = ({ latestResult, dataSaveStatus, setStage, getContent, setIsChatbotOpen }: Pick<AppProps, 'latestResult' | 'dataSaveStatus' | 'setStage' | 'getContent' | 'setIsChatbotOpen'>) => {
    if (!latestResult) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-3xl font-bold text-red-700 mb-4">ไม่พบผลการประเมิน</h2>
                <p className="text-gray-600 mb-6">กรุณาทำแบบสอบถามก่อนเพื่อเข้าถึงหน้านี้</p>
                <button
                    onClick={() => setStage('survey')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-xl shadow-md transition"
                >
                    ไปทำแบบสอบถาม
                </button>
                <button 
                    onClick={() => setIsChatbotOpen(true)}
                    className="mt-6 ml-4 bg-teal-500 hover:bg-teal-600 text-white font-medium py-2 px-4 rounded-xl shadow-md transition"
                >
                    เปิด AI Chat
                </button>
            </div>
        );
    }
    
    const content = getContent(latestResult.riskLevel);
    
    return (
        <div className="p-8 text-center">
            <h2 className="text-3xl font-bold text-indigo-800 mb-4">ผลการประเมินสุขภาพจิตล่าสุด</h2>
            <p className="text-gray-500 mb-4">ประเมินเมื่อ: {new Date(latestResult.timestamp).toLocaleString()}</p>
            
            <p className={`inline-block py-2 px-6 rounded-full font-extrabold text-lg shadow-md mb-6 ${content.color.replace(/bg-.*-100/g, 'bg-white').replace(/border-.*-500/g, 'border-2 border-current')}`} style={{ color: content.color.match(/text-(.*?)-(800|900)/)?.[1] }}>
                ระดับความเสี่ยง: {latestResult.riskLevel}
            </p>

            <div className={`p-6 rounded-xl shadow-lg ${content.color} border-l-4 mb-8 text-left`}>
                <h3 className="text-2xl font-semibold mb-3">{content.title}</h3>
                <p className="text-lg">{content.advice}</p>
                {latestResult.riskLevel === 'High' && (
                    <div className='mt-4 p-3 bg-red-200 rounded-xl text-red-800 font-bold'>
                        หากมีอาการวิกฤต โปรดติดต่อสายด่วนสุขภาพจิต 1323 ทันที
                    </div>
                )}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                    onClick={() => setStage('survey_new')}
                    className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition"
                >
                    ทำแบบสอบถามใหม่
                </button>
                 <button 
                    onClick={() => setIsChatbotOpen(true)}
                    className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-medium py-3 px-6 rounded-xl shadow-md transition"
                >
                    เปิด AI Chat
                </button>
            </div>
            {dataSaveStatus && <p className="mt-4 text-sm text-gray-500">{dataSaveStatus}</p>}
        </div>
    );
};

// 5. Chatbot Modal Component (Low Contrast UI)
const ChatbotModal = ({ isOpen, onClose, chatHistory, chatInput, setChatInput, handleChatSubmit, isLoading, messagesEndRef, chatInputRef }: {
    isOpen: boolean;
    onClose: () => void;
    chatHistory: ChatMessage[];
    chatInput: string;
    setChatInput: (input: string) => void;
    handleChatSubmit: (e: React.FormEvent) => Promise<void>;
    isLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    chatInputRef: React.RefObject<HTMLInputElement | null>; 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col h-[700px]">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-indigo-800">AI Chatbot ผู้ให้การสนับสนุน</h2>
                    {/* ปุ่มปิด (คลิกออก) Light Theme UI */}
                    <button onClick={onClose} className="bg-indigo-700 text-white-600 hover:text-red-500 text-3xl font-light leading-none transition">
                        &times;
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {chatHistory.length === 0 && (
                        <div className="text-center text-gray-600 mt-12">
                            ฉันพร้อมรับฟังและให้กำลังใจคุณ<br/>
                            มีเรื่องไหนที่อยากจะปรึกษาไหมคะ?
                        </div>
                    )}
                    {chatHistory.map((msg: ChatMessage, index: number) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs sm:max-w-md p-3 rounded-xl shadow-md whitespace-pre-wrap ${msg.role === 'user' 
                                // User Bubble: Indigo 500
                                ? 'bg-indigo-500 text-white rounded-br-none' 
                                // AI Bubble: Gray 200
                                : 'bg-gray-200 text-gray-700 rounded-tl-none'}`}>
                                <p>{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="p-3 rounded-xl shadow-md bg-gray-200 text-gray-600 animate-pulse">
                                AI กำลังพิมพ์...
                             </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleChatSubmit} className="p-4 border-t border-gray-200 flex gap-2">
                    <input
                        type="text"
                        ref={chatInputRef} 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="พิมพ์ข้อความของคุณที่นี่..."
                        className="flex-1 p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 transition text-gray-800"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        className="bg-indigo-700 hover:bg-indigo-600 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition duration-300 disabled:opacity-50"
                        disabled={isLoading || !chatInput.trim()}
                    >
                        {isLoading ? 'ส่ง...' : 'ส่ง'}
                    </button>
                </form>
            </div>
        </div>
    );
};


// 6. Routing Function
// *** ฟังก์ชันนี้ถูกใช้ใน AppCore.tsx เพื่อจัดการ Routing ***
(window as any)._renderPageLogic = (props: AppProps) => {
    switch (props.stage) {
        case 'home':
            return <HomePage 
                userName={props.userName} 
                setUserName={props.setUserName} 
                handleRegister={props.handleRegister} 
                loginStatus={props.loginStatus} 
                setIsChatbotOpen={props.setIsChatbotOpen}
                userId={props.userId}
                lastRegistrationDate={props.lastRegistrationDate}
            />;
        
        case 'survey':
        case 'survey_new': // ใช้ Stage survey_new เพื่อบังคับแสดง Form
            return <SurveyPage 
                hasTakenSurvey={props.stage === 'survey_new' ? false : props.hasTakenSurvey}
                latestResult={props.latestResult}
                setStage={props.setStage}
                submitSurvey={props.submitSurvey}
                surveyResponses={props.surveyResponses}
                handleSurveyChange={props.handleSurveyChange}
                setIsChatbotOpen={props.setIsChatbotOpen}
            />;

        case 'result':
            return <ResultPage 
                latestResult={props.latestResult}
                dataSaveStatus={props.dataSaveStatus}
                setStage={props.setStage}
                getContent={props.getContent}
                setIsChatbotOpen={props.setIsChatbotOpen}
            />;

        default:
            return <HomePage 
                userName={props.userName} 
                setUserName={props.setUserName} 
                handleRegister={props.handleRegister} 
                loginStatus={props.loginStatus} 
                setIsChatbotOpen={props.setIsChatbotOpen}
                userId={props.userId}
                lastRegistrationDate={props.lastRegistrationDate}
            />;
    }
};
// --- END OF COMPONENT PAGES ---

export default App;