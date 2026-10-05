/** Written on first launch so the file documents itself. JSONC: comments are allowed. */
export const SETTINGS_TEMPLATE = `// Glaceon Terminal settings. Changes apply as soon as you save.
// Remove the "//" in front of a line to change that setting.
{
  // "fontFamily": "\\"JetBrains Mono\\", Menlo, monospace",
  // "fontSize": 13,
  // "lineHeight": 1.2,
  // "letterSpacing": 0,

  // tokyo-night, catppuccin-mocha, dracula, nord, gruvbox-dark, one-dark, solarized-dark
  // "theme": "tokyo-night",
  // "backgroundOpacity": 0.72,     // below 1 the desktop shows through
  // "backgroundBlur": false,       // true: frosted glass instead of a sharp desktop
  // "backgroundColor": "",         // "#rrggbb" painted behind the terminal
  // "backgroundImage": "",         // e.g. "~/Pictures/wallpaper.jpg"
  // "backgroundImageFit": "cover", // cover | contain | fill
  // "backgroundImageOpacity": 1,

  // "shell": "",                    // e.g. "/opt/homebrew/bin/fish"; empty: your login shell
  // "cursorStyle": "block",        // block | bar | underline
  // "cursorBlink": true,
  // "scrollback": 10000,
  // "macOptionIsMeta": false,      // true makes ⌥ send Meta instead of typing characters like @
  // "copyOnSelect": false,
  // "confirmCloseRunningProcess": true,
  // "closeOnExit": "clean",        // always | clean (exit code 0) | never

  // Opens file:line:col links. {file} {line} {col} are replaced.
  // "editorCommand": "code -g {file}:{line}:{col}",

  // Drop-down terminal on a global shortcut, on the screen the pointer is on.
  // "quakeEnabled": true,
  // "quakeShortcut": "ctrl+\`",
  // "quakeHeight": 0.45,
  // "quakeHideOnBlur": true,       // hide when you click into another app

  // Later entries win. Prefix a command with "-" to remove its default binding.
  "keybindings": [
    // { "key": "cmd+e", "command": "pane.splitRight" },
    // { "key": "", "command": "-tab.next" }
  ]
}
`;
