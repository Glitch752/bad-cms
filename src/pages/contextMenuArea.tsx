import React, { useState } from "react";
import {
    ControlledMenu,
    useMenuState
} from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';

export default function ContextMenuArea({ children, ...props }) {
    const [menuProps, toggleMenu] = useMenuState();
    const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });

    return (
        <div onContextMenu={e => {
            e.preventDefault();
            setAnchorPoint({ x: e.clientX, y: e.clientY });
            toggleMenu(true);
        }}>
            { children }
            <ControlledMenu {...menuProps} anchorPoint={anchorPoint}
                onClose={() => toggleMenu(false)}>
                { props.menuItems }
            </ControlledMenu>
        </div >
    )
}