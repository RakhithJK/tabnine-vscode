import { useState, useEffect } from 'react';
import { ExtensionMessageEvent } from '../types/MessageEventTypes';
import { vscode } from '../utils/vscodeApi';

type EditorContext = {
    fileText: string;
    highlightedText: string;
}

export function useEditorContext(): [string, boolean] {
    const [editorContext, setEditorContext] = useState('');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        vscode.postMessage({
            command: 'get_editor_context'
        });

        const handleMessage = (event: ExtensionMessageEvent<EditorContext>) => {
            const message = event.data;
            if (message.command === 'get_editor_context') {
                setEditorContext(`This is my code: \`\`\`${message.payload?.fileText}\`\`\`\n\nThis is my highlighted code: \`\`\`${message.payload?.highlightedText}\`\`\``);
                setIsReady(true);
            }
        }
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        }
    }, []);

    return [editorContext, isReady];
}