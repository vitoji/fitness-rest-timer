name: minimax-api
description: MINIMAX API integration for AI chat capabilities, supporting OpenAI compatible format

parameters:
  api_key:
    type: string
    description: MINIMAX API key
    required: true
  model:
    type: string
    description: Model name to use
    default: MiniMax-M2.7
    enum:
      - MiniMax-M2.7
      - MiniMax-M2.7-highspeed
      - MiniMax-M2.5
      - MiniMax-M2.5-highspeed
      - MiniMax-M2.1
      - MiniMax-M2.1-highspeed
      - MiniMax-M2
  system_prompt:
    type: string
    description: System prompt for the AI
  user_prompt:
    type: string
    description: User prompt for the AI
    required: true
  message_history:
    type: array
    description: Previous messages in the conversation
    items:
      type: object
      properties:
        role:
          type: string
          enum:
            - system
            - user
            - assistant
        content:
          type: string
  temperature:
    type: number
    description: Temperature parameter (0.0-1.0)
    default: 1.0
  reasoning_split:
    type: boolean
    description: Whether to separate thinking content into reasoning_details field
    default: false

documentation:
  api_endpoint: https://api.minimax.io/v1/chat/completions
  environment_variables:
    OPENAI_BASE_URL: https://api.minimax.io/v1
    OPENAI_API_KEY: "${YOUR_API_KEY}"
  supported_models:
    - name: MiniMax-M2.7
      context_window: "204,800"
      description: "Beginning the journey of recursive self-improvement (output speed approximately 60 tps)"
    - name: MiniMax-M2.7-highspeed
      context_window: "204,800"
      description: "M2.7 Highspeed: Same performance, faster and more agile (output speed approximately 100 tps)"
    - name: MiniMax-M2.5
      context_window: "204,800"
      description: "Peak Performance. Ultimate Value. Master the Complex (output speed approximately 60 tps)"
    - name: MiniMax-M2.5-highspeed
      context_window: "204,800"
      description: "M2.5 highspeed: Same performance, faster and more agile (output speed approximately 100 tps)"
    - name: MiniMax-M2.1
      context_window: "204,800"
      description: "Powerful Multi-Language Programming Capabilities with Comprehensively Enhanced Programming Experience (output speed approximately 60 tps)"
    - name: MiniMax-M2.1-highspeed
      context_window: "204,800"
      description: "Faster and More Agile (output speed approximately 100 tps)"
    - name: MiniMax-M2
      context_window: "204,800"
      description: "Agentic capabilities, Advanced reasoning"
  important_notes:
    - "The temperature parameter range is (0.0, 1.0], recommended value: 1.0, values outside this range will return an error"
    - "Some OpenAI parameters (such as presence_penalty, frequency_penalty, logit_bias, etc.) will be ignored"
    - "Image and audio type inputs are not currently supported"
    - "The n parameter only supports value 1"
    - "The deprecated function_call is not supported, please use the tools parameter"
  examples:
    basic_call:
      code: |
        from openai import OpenAI

        client = OpenAI()

        response = client.chat.completions.create(
            model="MiniMax-M2.7",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hi, how are you?"},
            ],
            extra_body={"reasoning_split": True},
        )

        print(f"Thinking:\n{response.choices[0].message.reasoning_details[0]['text']}\n")
        print(f"Text:\n{response.choices[0].message.content}\n")
    streaming_response:
      code: |
        from openai import OpenAI

        client = OpenAI()

        print("Starting stream response...\n")
        print("=" * 60)
        print("Thinking Process:")
        print("=" * 60)

        stream = client.chat.completions.create(
            model="MiniMax-M2.7",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hi, how are you?"},
            ],
            extra_body={"reasoning_split": True},
            stream=True,
        )

        reasoning_buffer = ""
        text_buffer = ""

        for chunk in stream:
            if (
                hasattr(chunk.choices[0].delta, "reasoning_details")
                and chunk.choices[0].delta.reasoning_details
            ):
                for detail in chunk.choices[0].delta.reasoning_details:
                    if "text" in detail:
                        reasoning_text = detail["text"]
                        new_reasoning = reasoning_text[len(reasoning_buffer) :]
                        if new_reasoning:
                            print(new_reasoning, end="", flush=True)
                            reasoning_buffer = reasoning_text

            if chunk.choices[0].delta.content:
                content_text = chunk.choices[0].delta.content
                new_text = content_text[len(text_buffer) :] if text_buffer else content_text
                if new_text:
                    print(new_text, end="", flush=True)
                    text_buffer = content_text

        print("\n" + "=" * 60)
        print("Response Content:")
        print("=" * 60)
        print(f"{text_buffer}\n")