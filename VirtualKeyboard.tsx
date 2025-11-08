import { useEffect, useRef } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { X } from "lucide-react";

interface VirtualKeyboardProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  layout?: "default" | "numeric";
}

export const VirtualKeyboard = ({
  inputRef,
  onClose,
  layout = "default",
}: VirtualKeyboardProps) => {
  const keyboardRef = useRef<any>(null);

  useEffect(() => {
    // Sync keyboard with input value
    if (keyboardRef.current && inputRef.current) {
      keyboardRef.current.setInput(inputRef.current.value);
    }
  }, [inputRef]);

  const onChange = (input: string) => {
    if (inputRef.current) {
      // Update input value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputRef.current, input);
      }

      // Trigger React's onChange event
      const event = new Event("input", { bubbles: true });
      inputRef.current.dispatchEvent(event);
    }
  };

  const onKeyPress = (button: string) => {
    if (button === "{enter}") {
      // Trigger enter key event
      if (inputRef.current) {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          bubbles: true,
        });
        inputRef.current.dispatchEvent(event);
      }
    }
  };

  const numericLayout = {
    default: ["1 2 3", "4 5 6", "7 8 9", ". 0 {bksp}"],
  };

  const defaultLayout = {
    default: [
      "1 2 3 4 5 6 7 8 9 0 {bksp}",
      "й ц у к е н г ш щ з х ъ",
      "ф ы в а п р о л д ж э",
      "я ч с м и т ь б ю .",
      "{space}",
    ],
    shift: [
      "! @ # $ % ^ & * ( ) {bksp}",
      "Й Ц У К Е Н Г Ш Щ З Х Ъ",
      "Ф Ы В А П Р О Л Д Ж Э",
      "Я Ч С М И Т Ь Б Ю ?",
      "{space}",
    ],
  };

  const display = {
    "{bksp}": "⌫",
    "{enter}": "Enter",
    "{space}": "Пробел",
    "{shift}": "⇧",
    "{lock}": "Caps",
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-4 border-blue-500 shadow-2xl animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div className="flex items-center space-x-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          <span className="font-semibold">Виртуальная клавиатура</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
          title="Закрыть клавиатуру"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Keyboard */}
      <div className="p-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <Keyboard
            keyboardRef={(r: any) => (keyboardRef.current = r)}
            onChange={onChange}
            onKeyPress={onKeyPress}
            layout={layout === "numeric" ? numericLayout : defaultLayout}
            display={display}
            theme="hg-theme-default hg-layout-default custom-keyboard"
            buttonTheme={[
              {
                class: "hg-primary",
                buttons: "{enter}",
              },
              {
                class: "hg-danger",
                buttons: "{bksp}",
              },
              {
                class: "hg-space",
                buttons: "{space}",
              },
            ]}
          />
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .custom-keyboard .hg-button {
          height: 50px;
          font-size: 18px;
          font-weight: 600;
          border-radius: 8px;
          margin: 4px;
          background: white;
          border: 2px solid #e5e7eb;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: all 0.15s ease;
        }

        .custom-keyboard .hg-button:active,
        .custom-keyboard .hg-button:hover {
          background: #3b82f6;
          color: white;
          border-color: #2563eb;
          transform: scale(0.95);
        }

        .custom-keyboard .hg-button.hg-primary {
          background: #10b981;
          color: white;
          border-color: #059669;
          min-width: 100px;
        }

        .custom-keyboard .hg-button.hg-primary:active,
        .custom-keyboard .hg-button.hg-primary:hover {
          background: #059669;
          border-color: #047857;
        }

        .custom-keyboard .hg-button.hg-danger {
          background: #ef4444;
          color: white;
          border-color: #dc2626;
          min-width: 80px;
        }

        .custom-keyboard .hg-button.hg-danger:active,
        .custom-keyboard .hg-button.hg-danger:hover {
          background: #dc2626;
          border-color: #b91c1c;
        }

        .custom-keyboard .hg-button.hg-space {
          background: #f3f4f6;
          border-color: #d1d5db;
          min-width: 300px;
        }

        .custom-keyboard .hg-button.hg-space:active,
        .custom-keyboard .hg-button.hg-space:hover {
          background: #e5e7eb;
          border-color: #9ca3af;
          color: #374151;
        }

        .custom-keyboard .hg-row {
          display: flex;
          justify-content: center;
        }

        .custom-keyboard {
          background: transparent;
          padding: 0;
        }

        /* Numeric keyboard specific styles.*/
        .custom-keyboard.hg-layout-numeric .hg-button {
          height: 70px;
          font-size: 24px;
        }
      `}</style>
    </div>
  );
};
