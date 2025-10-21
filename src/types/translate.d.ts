declare global {
	interface Window {
		translate?: {
			changeLanguage: (language: string) => void;
			service: {
				use: (service: string) => void;
			};
			language: {
				setLocal: (language: string) => void;
				getCurrent: () => string;
				getLocal: () => string;
				translateLocal: boolean; // 允许翻译本地语种
			};
			setAutoDiscriminateLocalLanguage: () => void;
			ignore: {
				class: string[];
				tag: string[];
			};
			selectLanguageTag: {
				show: boolean;
				refreshRender?: () => void;
			};
			listener: {
				start: () => void;
			};
			execute: () => void;
			reset: () => void; // 重置翻译状态
			to: string;
			storage: {
				set: (key: string, value: string) => void;
			};
		};
		loadTranslateScript?: () => Promise<void>;
		translateScriptLoaded?: boolean; // 标记脚本是否已加载
		translateInitialized?: boolean; // 标记翻译是否已初始化
	}
}

export {};
