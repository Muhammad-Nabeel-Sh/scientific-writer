هذه عينة من code مكتوب بلغة python

```python
# --- SIDEBAR CONTROLS ---
st.sidebar.header("Simulation Parameters")
# 1. Population Distribution Type
dist_type = st.sidebar.selectbox(
    "1. Select Population Distribution", ("Uniform", "Exponential", "Normal", "Beta")
)
# 2. Sample Size (n)
n_size = st.sidebar.slider("2. Sample Size (n)", min_value=1, max_value=100, value=30)
# 3. Number of Iterations (How many samples to take)
iterations = st.sidebar.slider(
    "3. Number of Iterations", min_value=10, max_value=1000, value=100
)
```



يمكن تغيير لون code block باستخدام أحد الأوامر التالية:
* استخدام مكتبة HighlighJS
* يمكن الرجوع إلى 


جدول: 
|  عنوان 1 | عنوان 2 | عنوان 3 | عنوان 4  |
| :--- | :--- | :--- | :--- |
|  خلية 1.1 | خلية 1.2 | خلية 1.3 | خلية 1.4  |
|  خلية 2.1 | خلية 2.2 | خلية 2.3 | خلية 2.4  |
|  خلية 3.1 | خلية 3.2 | خلية 3.3 | خلية 3.4  |




