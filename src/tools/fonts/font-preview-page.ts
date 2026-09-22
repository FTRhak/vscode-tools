import * as vscode from 'vscode';

export const fontPreviewCommand = 'vscode-tools.fonts.openFontPreview';

export function registerFontPreviewCommand(context: vscode.ExtensionContext): vscode.Disposable[] {
    let commands: vscode.Disposable[] = [];
    //context.subscriptions.push();
    commands.push(
        vscode.commands.registerCommand(
            fontPreviewCommand,
            async (uri?: vscode.Uri) => {
                const fontUri = uri ?? vscode.window.activeTextEditor?.document.uri;
                if (!fontUri || !/\.(woff2?|ttf|otf|eot)$/i.test(fontUri.fsPath)) {
                    await vscode.window.showErrorMessage('There is no font file selected.');
                    return;
                }

                const fileName = fontUri.path.split('/').pop() ?? 'Font preview';
                const fontDirectory = vscode.Uri.file(fontUri.fsPath.replace(/[\\/][^\\/]+$/, ''));
                const panel = vscode.window.createWebviewPanel(
                    'fontPreview',
                    fileName,
                    vscode.ViewColumn.Active,
                    {
                        enableScripts: false,
                        localResourceRoots: [fontDirectory, context.extensionUri],
                    },
                );
                const fontUrl = panel.webview.asWebviewUri(fontUri);
                const safeName = escapeHtml(fileName);

                panel.webview.html = getWebviewContent(panel, context.extensionUri, fontUrl, safeName);

            },
        )
    );
    return commands;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character] ?? character);
}


export function getWebviewContent(
    panel: any,
    extensionUri: vscode.Uri,
    fontUrl: vscode.Uri,
    fontName: string
): string {
    const stylePath = vscode.Uri.joinPath(
        extensionUri,
        "dist",
        "media",
        "styles.css",
    );
    const styleUri = panel.webview.asWebviewUri(stylePath);
    const glyphs = Array.from(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        + '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~'
        + 'АБВГДЕЁЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
        + 'абвгдеёжзиіїйклмнопрстуфхцчшщъыьэюя'
        + 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'
        + 'αβγδεζηθικλμνξοπρστυφχψω'
        + 'אבגדהוזחטיכלמנסעפצקרשת'
        + 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
    );
    const breaks = Array.from('a0!АаΑαבア');
    const glyphCards = glyphs.map((symbol) => `
        ${breaks.includes(symbol) ? '<div class="glyph-card-break"></div>' : ''}
        <div class="glyph-card" title="${escapeHtml(symbol)}">
            <div class="glyph-symbol">${escapeHtml(symbol)}</div>
            <div class="glyph-code">${escapeHtml(symbol)}</div>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Preview Font</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; font-src ${panel.webview.cspSource} data:;">
  <style>
        @font-face {
            font-family: preview;
            src: url('${fontUrl}');
            font-display: swap;
        }
        .font-code-result,
        .glyph-symbol {
            font-family: preview, sans-serif;
        }
  </style>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <div class="fonts-alphabet">
    <h2>Preview Font: "${fontName}"</h2>
    <div class="form-font-code-to-simbol" >
        <input type="text" id="fontCodeInput" oninput="fontCodeResult.innerText = String.fromCharCode(fontCodeInput.value)" placeholder="Character code">
        <div id="fontCodeResult" class="font-code-result"></div>
    </div>
    <div class="glyph-grid">
        ${glyphCards}
    </div>
  </div>
</body>
</html>`;
}

