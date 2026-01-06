export const mapEventToElectronAccelerator = (e) => {
    const keys = [];
    
    // 1. 处理修饰键 (Modifiers)
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.metaKey) keys.push('Command'); // Mac Command
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');

    // 2. 处理主键 (Main Key)
    let key = e.key;

    // 忽略单独按下的修饰键
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
        return keys.join('+');
    }

    // 3. 映射特殊按键名为 Electron 标准
    const keyMap = {
        ' ': 'Space',
        'ArrowUp': 'Up',
        'ArrowDown': 'Down',
        'ArrowLeft': 'Left',
        'ArrowRight': 'Right',
        'Escape': 'Esc',
        'Insert': 'Insert',
        'Delete': 'Delete',
        'Home': 'Home',
        'End': 'End',
        'PageUp': 'PageUp',
        'PageDown': 'PageDown',
        'Tab': 'Tab',
        'Enter': 'Enter',
        'Backspace': 'Backspace',
        '~': 'Tilde',
        '`': 'Tilde'
    };

    // 字母转大写
    if (key.length === 1) key = key.toUpperCase();
    if (keyMap[key]) key = keyMap[key];

    keys.push(key);
    return keys.join('+');
};