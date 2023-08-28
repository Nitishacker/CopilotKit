import "./base-copilot-textarea.css";
import {
  TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Descendant, Editor } from "slate";
import { Editable, Slate } from "slate-react";
import { twMerge } from "tailwind-merge";
import { useAutosuggestions } from "../../hooks/use-autosuggestions";
import { useCopilotTextareaEditor } from "../../hooks/use-copilot-textarea-editor";
import {
  getFullEditorTextWithNewlines,
  getTextAroundCursor,
} from "../../lib/get-text-around-cursor";
import { addAutocompletionsToEditor } from "../../lib/slatejs-edits/add-autocompletions";
import { clearAutocompletionsFromEditor } from "../../lib/slatejs-edits/clear-autocompletions";
import { replaceEditorText } from "../../lib/slatejs-edits/replace-text";
import {
  AutosuggestionsBareFunction,
  BaseAutosuggestionsConfig,
  defaultBaseAutosuggestionsConfig,
} from "../../types/base";
import { AutosuggestionState } from "../../types/base/autosuggestion-state";
import { makeRenderElementFunction } from "./render-element";
import { makeRenderPlaceholderFunction } from "./render-placeholder";
import { useAddBrandingCss } from "./use-add-branding-css";

export interface BaseCopilotTextareaProps
  extends TextareaHTMLAttributes<HTMLDivElement> {
  disableBranding?: boolean;
  placeholderStyle?: React.CSSProperties;
  suggestionsStyle?: React.CSSProperties;
  value?: string;
  onValueChange?: (value: string) => void;
  autosuggestionsConfig: Partial<BaseAutosuggestionsConfig> & {
    purposePrompt: string;
  };
}

export function BaseCopilotTextarea(
  props: BaseCopilotTextareaProps & {
    autosuggestionsFunction: AutosuggestionsBareFunction;
  }
): JSX.Element {
  const autosuggestionsConfig: BaseAutosuggestionsConfig = {
    ...defaultBaseAutosuggestionsConfig,
    ...props.autosuggestionsConfig,
  };

  const valueOnInitialRender = useMemo(() => props.value ?? "", []);
  const [lastKnownFullEditorText, setLastKnownFullEditorText] =
    useState(valueOnInitialRender);

  const initialValue: Descendant[] = useMemo(() => {
    return [
      {
        type: "paragraph",
        children: [{ text: valueOnInitialRender }],
      },
    ];
  }, [valueOnInitialRender]);

  const editor = useCopilotTextareaEditor();

  const insertText = useCallback(
    (autosuggestion: AutosuggestionState) => {
      Editor.insertText(editor, autosuggestion.text, {
        at: autosuggestion.point,
      });
    },
    [editor]
  );

  const {
    currentAutocompleteSuggestion,
    onChangeHandler: onChangeHandlerForAutocomplete,
    onKeyDownHandler: onKeyDownHandlerForAutocomplete,
  } = useAutosuggestions(
    autosuggestionsConfig.debounceTime,
    autosuggestionsConfig.acceptAutosuggestionKey,
    props.autosuggestionsFunction,
    insertText,
    autosuggestionsConfig.disableWhenEmpty,
    autosuggestionsConfig.disabled
  );

  // sync autosuggestions state with the editor
  useEffect(() => {
    clearAutocompletionsFromEditor(editor);
    if (currentAutocompleteSuggestion) {
      addAutocompletionsToEditor(
        editor,
        currentAutocompleteSuggestion.text,
        currentAutocompleteSuggestion.point
      );
    }
  }, [currentAutocompleteSuggestion]);

  const suggestionStyleAugmented: React.CSSProperties = useMemo(() => {
    return {
      fontStyle: "italic",
      color: "gray",
      ...props.suggestionsStyle,
    };
  }, [props.suggestionsStyle]);

  useAddBrandingCss(suggestionStyleAugmented, props.disableBranding);

  const renderElementMemoized = useMemo(() => {
    return makeRenderElementFunction(suggestionStyleAugmented);
  }, [suggestionStyleAugmented]);

  const renderPlaceholderMemoized = useMemo(() => {
    // For some reason slateJS specifies a top value of 0, which makes for strange styling. We override this here.
    const placeholderStyleSlatejsOverrides: React.CSSProperties = {
      top: undefined,
    };

    const placeholderStyleAugmented: React.CSSProperties = {
      ...placeholderStyleSlatejsOverrides,
      ...props.placeholderStyle,
    };

    return makeRenderPlaceholderFunction(placeholderStyleAugmented);
  }, [props.placeholderStyle]);

  // update the editor text, but only when the value changes from outside the component
  useEffect(() => {
    if (props.value === lastKnownFullEditorText) {
      return;
    }

    setLastKnownFullEditorText(props.value ?? "");
    replaceEditorText(editor, props.value ?? "");
  }, [props.value]);

  // separate into TextareaHTMLAttributes<HTMLDivElement> and CopilotTextareaProps
  const {
    placeholderStyle,
    value,
    onValueChange,
    autosuggestionsConfig: autosuggestionsConfigFromProps,
    autosuggestionsFunction,
    className,
    ...propsToForward
  } = props;

  const moddedClassName = (() => {
    const baseClassName = "copilot-textarea";
    const brandingClass = props.disableBranding
      ? "no-branding"
      : "with-branding";
    const defaultTailwindClassName = "bg-white overflow-y-auto resize-y";
    const mergedClassName = twMerge(defaultTailwindClassName, className ?? "");
    return `${baseClassName} ${brandingClass} ${mergedClassName}`;
  })();

  return (
    // Add the editable component inside the context.
    <Slate
      editor={editor}
      initialValue={initialValue}
      onChange={(value) => {
        const newEditorState = getTextAroundCursor(editor);

        const fullEditorText = newEditorState
          ? newEditorState.textBeforeCursor + newEditorState.textAfterCursor
          : getFullEditorTextWithNewlines(editor); // we don't double-parse the editor. When `newEditorState` is null, we didn't parse the editor yet.

        setLastKnownFullEditorText(fullEditorText);
        onChangeHandlerForAutocomplete(newEditorState);
        props.onValueChange?.(fullEditorText);
      }}
    >
      <Editable
        renderElement={renderElementMemoized}
        renderPlaceholder={renderPlaceholderMemoized}
        onKeyDown={onKeyDownHandlerForAutocomplete}
        className={moddedClassName}
        {...propsToForward}
      />
    </Slate>
  );
}