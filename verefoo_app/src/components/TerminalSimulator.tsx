import { useAppContext } from '../context/AppContext';
import '../style/terminal.css';
import { useState, useRef, useEffect } from 'react';
import type { NetworkNode } from '../types/NodeTypes';
import { BACKEND_BASE_URL } from '../utils/constants';

type TerminalProps = {
	nodeId: number;
};

type Line =
	| { type: 'command'; cmd: string }
	| { type: 'output'; text: string };

export default function TerminalEmulator({ nodeId }: TerminalProps) {
	const { deployedNodes } = useAppContext();
	const [node, setNode] = useState<NetworkNode | undefined>(undefined);
	const [lines, setLines] = useState<Line[]>([
		{ type: 'output', text: `Type 'help' for available commands` },
	]);
	const [input, setInput] = useState('');
	const [isRunning, setIsRunning] = useState(false);
	const [history, setHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState<number | null>(null);
	const draftRef = useRef<string>('');
	const bottomRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const promptLabel = `root@${node?.name.toLowerCase().replace(/\s/g, '-')}:~$`;

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [lines, input]);

	useEffect(() => {
		if (!isRunning) inputRef.current?.focus();
	}, [isRunning]);

	useEffect(() => {
		setNode(deployedNodes.find(n => n.id === nodeId));
		console.log("Deployed nodes");
		console.log(deployedNodes);
	}, [deployedNodes]);

	useEffect(() => {
		if (!isRunning) return;
		const handleGlobalInterrupt = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key.toLowerCase() === 'c') {
				e.preventDefault();
				streamCommand("INTERRUPT", [], appendLine);
			}
		};
		window.addEventListener('keydown', handleGlobalInterrupt);
		return () => window.removeEventListener('keydown', handleGlobalInterrupt);
	}, [isRunning]);

	const setInputWithCursorEnd = (value: string) => {
		setInput(value);
		requestAnimationFrame(() => {
			const el = inputRef.current;
			if (el) el.setSelectionRange(value.length, value.length);
		});
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (isRunning) return;

		if (e.key === 'Enter') {
			const cmd = input.trim();
			if (!cmd) return;
			runCommand(cmd);
			setHistory(prev => (prev[prev.length - 1] === cmd ? prev : [...prev, cmd]));
			setHistoryIndex(null);
			draftRef.current = '';
			setInput('');
			return;
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (history.length === 0) return;
			setHistoryIndex(prev => {
				if (prev === null) {
					draftRef.current = input;
					const nextIndex = history.length - 1;
					setInputWithCursorEnd(history[nextIndex]);
					return nextIndex;
				}
				const nextIndex = Math.max(0, prev - 1);
				setInputWithCursorEnd(history[nextIndex]);
				return nextIndex;
			});
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (historyIndex === null) return;
			const nextIndex = historyIndex + 1;
			if (nextIndex >= history.length) {
				setHistoryIndex(null);
				setInputWithCursorEnd(draftRef.current);
			} else {
				setHistoryIndex(nextIndex);
				setInputWithCursorEnd(history[nextIndex]);
			}
			return;
		}
	};

	const runCommand = (cmd: string) => {
		setLines(prev => [...prev, { type: 'command', cmd }]);
		setIsRunning(true);
		resolveCommand(cmd, { nodeId, nodeName: node?.name || "", nodeType: node?.type || "" , nodeIp: node?.ip}, appendLine)
			.catch(err => appendLine(`error: ${(err as Error).message}`))
			.finally(() => setIsRunning(false));
	};

	const appendLine = (text: string) => {
		if (text === '__CLEAR__') {
			setLines([{ type: 'output', text: "Type 'help' for available commands" }]);
			return;
		}
		setLines(prev => [...prev, { type: 'output', text }]);
	};

	// Streams a command's output line-by-line as it's produced, instead of waiting
	// for the whole thing to finish and dumping it all at once.
	const streamCommand = async (cmd: string, args: string[], emit: (text: string) => void) => {
		try {
			const response = await fetch(BACKEND_BASE_URL + "execute-stream", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					node: node?.name,
					command: cmd,
					args,
				}),
			});

			if (!response.ok || !response.body) {
				if (response.status === 401) {
					const error = await response.json();
					return emit(error.error);
				}
				emit(`error: could not reach backend (status ${response.status})`);
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });

				let newlineIndex;
				while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
					const rawLine = buffer.slice(0, newlineIndex);
					buffer = buffer.slice(newlineIndex + 1);
					if (rawLine.trim()) handleStreamEvent(rawLine, emit);
				}
			}
			if (buffer.trim()) handleStreamEvent(buffer, emit);
		} catch (err) {
			emit(`error: could not reach backend (${(err as Error).message})`);
		}
	};

	const handleStreamEvent = (rawLine: string, emit: (text: string) => void) => {
		try {
			const event = JSON.parse(rawLine) as { type: 'stdout' | 'stderr' | 'done' | 'error'; text?: string };
			if ((event.type === 'stdout' || event.type === 'stderr') && event.text !== undefined) {
				emit(event.text);
			} else if (event.type === 'error' && event.text) {
				emit(`error: ${event.text}`);
			}
			// 'done' carries no output of its own, nothing to render
		} catch {
			emit(rawLine);
		}
	};

	async function resolveCommand(cmd: string, ctx: { nodeId: number, nodeName: string, nodeType: string, nodeIp?: string }, emit: (text: string) => void): Promise<void> {
		const parts = cmd.trim().split(/\s+/);
		const command = parts[0].toLowerCase();
    const args = parts.slice(1);
		switch (command) {
			case 'help':
				[
					'Available commands:',
					'  help         show this message',
					'  info         show node info',
					'  clear        clear terminal',
					'  ping         send ICMP ECHO_REQUEST to network hosts',
					'  traceroute   traces the route to a host by identifying the network hops along the path',
					'  ip           show / manipulate routing, network devices, interfaces and tunnels',
					'  iptables     administration tool for IPv4/IPv6 packet filtering and NAT',
					'  nmap         Network exploration tool and security / port scanner',
					'  nc		   arbitrary TCP and UDP connections and listens',
					'  tcpdump	   dump traffic on a network',
				].forEach(emit);
				return;
			case 'info':
				emit(`Node ID:   ${ctx.nodeId}`);
				emit(`Name:      ${ctx.nodeName}`);
				emit(`Type:      ${ctx.nodeType}`);
				emit(`IP:        ${ctx.nodeIp ?? 'N/A'}`);
				return;
			case 'ping':
				if (args.length == 1 && !args.includes("-c")){
					args.push("-c");
					args.push("3");
				}
				await streamCommand(command, args, emit);
				return;
            case 'traceroute':
				await streamCommand(command, args, emit);
				return;
			case 'ip':
				await streamCommand(command, args, emit);
				return;
			case 'iptables':
				await streamCommand(command, args, emit);
				return;
			case 'nmap':
				await streamCommand(command, args, emit);
				return;
			case 'nc':
				await streamCommand(command, args, emit);
				return;
			case 'tcpdump':
				await streamCommand(command, args, emit);
				return;
			case 'clear':
				emit('__CLEAR__');
				return;
			default:
				emit(`bash: ${cmd}: command not found`);
				return;
		}
	}

	if (!node) {
		return (
			<div>
				Selected node does not exist
			</div>
		);
	}

	return (
		<div className="terminal-wrapper">
			<div className="terminal-titlebar">
				<div className="terminal-dots">
					<span className="terminal-dot terminal-dot-red" />
					<span className="terminal-dot terminal-dot-yellow" />
					<span className="terminal-dot terminal-dot-green" />
				</div>
				<span className="terminal-title">{node?.name} — {node?.type}</span>
			</div>
			<div className="terminal-body" onClick={() => inputRef.current?.focus()}>
				{lines.map((line, i) => (
					line.type === 'command'
						? (
							<div key={i} className="terminal-line terminal-command-line">
								<span className="terminal-prompt">{promptLabel}</span>
								<span>{line.cmd}</span>
							</div>
						)
						: <div key={i} className="terminal-line">{line.text}</div>
				))}
				{!isRunning && (
					<div className="terminal-line terminal-current-line">
						<span className="terminal-prompt">{promptLabel}</span>
						<input
							ref={inputRef}
							className="terminal-input"
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							autoFocus
							spellCheck={false}
							autoComplete="off"
						/>
					</div>
				)}
				<div ref={bottomRef} />
			</div>
		</div>
	);
}
