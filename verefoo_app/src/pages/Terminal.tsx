import TerminalEmulator from '../components/TerminalSimulator';

export default function Terminal() {
	const params = new URLSearchParams(window.location.search);
	const nodeId = params.get('nodeId');

	if (!nodeId) {
		return (
			<div style={{ background: 'var(--text-main)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<p style={{ color: 'var(--secondary-stroke)', fontFamily: 'var(--font-main)' }}>Open this page via Deploy.</p>
			</div>
		);
	}

	return (
		<TerminalEmulator
			nodeId={Number(nodeId)}
		/>
	);
}