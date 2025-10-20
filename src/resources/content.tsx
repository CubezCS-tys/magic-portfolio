import { About, Blog, Gallery, Home, Newsletter, Person, Social, Work } from "@/types";
import { Line, Logo, Row, Text } from "@once-ui-system/core";

const person: Person = {
  firstName: "Tahar Yassine",
  lastName: "Soltani",
  name: `Tahar Yassine Soltani`,
  role: "Full-Stack AI Engineer & Quantitative Developer",
  avatar: "/images/avatar.jpg",
  email: "ysolta1969@gmail.com",
  location: "Europe/London", // Expecting the IANA time zone identifier, e.g., 'Europe/Vienna'
  languages: ["English", "French", "Arabic"], // optional: Leave the array empty if you don't want to display languages
};

const newsletter: Newsletter = {
  display: false,
  title: <>Subscribe to {person.firstName}'s Newsletter</>,
  description: <>My weekly newsletter about AI engineering and quantitative finance</>,
};

const social: Social = [
  // Links are automatically displayed.
  // Import new icons in /once-ui/icons.ts
  {
    name: "GitHub",
    icon: "github",
    link: "https://github.com/CubezCS-sys",
  },
  {
    name: "LinkedIn",
    icon: "linkedin",
    link: "https://linkedin.com/in/tahar-yassine-soltani",
  },
  {
    name: "Portfolio",
    icon: "link",
    link: "https://barrier-options.streamlit.app",
  },
  {
    name: "Email",
    icon: "email",
    link: `mailto:${person.email}`,
  },
];

const home: Home = {
  path: "/",
  image: "/images/og/home.jpg",
  label: "Home",
  title: `${person.name}'s Portfolio`,
  description: `Portfolio website showcasing my work as a ${person.role}`,
  headline: <>Building intelligent systems for quantitative finance</>,
  featured: {
    display: true,
    title: (
      <Row gap="12" vertical="center">
        <strong className="ml-4">Barrier Options</strong>{" "}
        <Line background="brand-alpha-strong" vert height="20" />
        <Text marginRight="4" onBackground="brand-medium">
          Featured work
        </Text>
      </Row>
    ),
    href: "/work/pricing-barrier-options-research-computational-finance",
  },
  subline: (
    <>
      I'm Tahar Yassine, a full-stack AI engineer and quantitative developer currently pursuing my MSc in Financial Mathematics at King's College London.
      <br /> I specialize in building AI-powered systems, algorithmic trading engines, and computational finance solutions.
    </>
  ),
};

const about: About = {
  path: "/about",
  label: "About",
  title: `About – ${person.name}`,
  description: `Meet ${person.name}, ${person.role} from ${person.location}`,
  tableOfContent: {
    display: true,
    subItems: false,
  },
  avatar: {
    display: true,
  },
  calendar: {
    display: true,
    link: "https://cal.com",
  },
  intro: {
    display: true,
    title: "Introduction",
    description: (
      <>
        Tahar Yassine is a London-based AI engineer and quantitative developer with expertise in computational finance, 
        machine learning, and distributed systems. Currently pursuing an MSc in Financial Mathematics at King's College London, 
        he combines strong mathematical foundations with practical software engineering to build scalable AI-powered solutions 
        for finance and research applications.
      </>
    ),
  },
  work: {
    display: true, // set to false to hide this section
    title: "Work Experience",
    experiences: [
      {
        company: "Arabic Publishing Group (RAG Platform)",
        timeframe: "Jun 2025 - Present",
        role: "Full-Stack AI Engineer",
        achievements: [
          <>
            Developed a large-scale retrieval-augmented generation (RAG) platform powering AI-assisted research across millions of Arabic documents.
          </>,
          <>
            Built scalable pipelines converting unstructured data to JSON datasets; optimised chunking, embedding, and vectorisation for retrieval efficiency.
          </>,
          <>
            Deployed distributed databases (FAISS, Milvus) and engineered low-latency similarity-search infrastructure with caching and query optimisation.
          </>,
          <>
            Achieved 2.3× retrieval speedup and 90% latency reduction through query batching and parallelisation.
          </>,
          <>
            Created fail-safe analytics dashboards for monitoring latency, throughput and query statistics, enabling data-driven system optimisation.
          </>,
          <>
            Strengthened robustness via statistical error monitoring and redundancy mechanisms across distributed nodes.
          </>,
        ],
        images: [],
      },
      {
        company: "Brunel University London",
        timeframe: "Sept 2023 - Apr 2025",
        role: "Teaching Assistant",
        achievements: [
          <>
            Supported undergraduate modules in Mathematical Programming, Fundamentals of Mathematics, and Statistics.
          </>,
          <>
            Led MATLAB and R sessions, reinforcing numerical computation and stochastic process problem-solving.
          </>,
          <>
            Provided individual support and formative feedback to over 150 students, improving quantitative reasoning and programming fluency.
          </>,
        ],
        images: [],
      },
    ],
  },
  studies: {
    display: true, // set to false to hide this section
    title: "Education",
    institutions: [
      {
        name: "King's College London",
        description: <>MSc Financial Mathematics (Sept 2025 - Sept 2026) - Selected coursework: Risk-Neutral Valuation, Stochastic Analysis, Numerical Methods in Finance, C++ for Financial Mathematics, Machine Learning, and Stochastic Control. Focus areas: derivative pricing, quantitative risk management, and algorithmic optimisation.</>,
      },
      {
        name: "Brunel University of London",
        description: <>BSc (Hons) Mathematics with Computer Science (Sept 2022 - Jun 2025) - First Class Honours (82% Average). Relevant coursework: PDEs, Numerical Analysis, Stochastic Processes, Artificial Intelligence, Software Engineering. Planned dissertation: Numerical methods for stochastic volatility models in derivative pricing.</>,
      },
    ],
  },
  technical: {
    display: true, // set to false to hide this section
    title: "Technical Skills",
    skills: [
      {
        title: "Programming Languages",
        description: (
          <>Proficient in Python, C++, MATLAB, R, SQL, Java, and Git for quantitative development and data analysis.</>
        ),
        tags: [
          {
            name: "Python",
            icon: "python",
          },
          {
            name: "C++",
            icon: "code",
          },
          {
            name: "JavaScript",
            icon: "javascript",
          },
        ],
        images: [],
      },
      {
        title: "AI & Machine Learning",
        description: (
          <>Experienced with NumPy, Pandas, SciPy, QuantLib, PyTorch, TensorFlow, Scikit-learn for quantitative modeling and ML applications.</>
        ),
        tags: [
          {
            name: "PyTorch",
            icon: "code",
          },
          {
            name: "TensorFlow",
            icon: "code",
          },
        ],
        images: [],
      },
      {
        title: "Data Infrastructure",
        description: (
          <>Built distributed systems with Streamlit, Flask, Plotly, Matplotlib, FAISS, and Milvus for real-time analytics and vector search.</>
        ),
        tags: [
          {
            name: "Database",
            icon: "database",
          },
        ],
        images: [],
      },
      {
        title: "Systems & DevOps",
        description: (
          <>Developed on Linux (Ubuntu) and Windows environments with strong command-line proficiency.</>
        ),
        tags: [
          {
            name: "Linux",
            icon: "terminal",
          },
        ],
        images: [],
      },
    ],
  },
};

const blog: Blog = {
  path: "/blog",
  label: "Blog",
  title: "Insights on AI Engineering, Quantitative Finance & Software Development",
  description: `Exploring machine learning systems, computational finance, numerical methods, and lessons from building production AI applications`,
  // Create new blog posts by adding a new .mdx file to app/blog/posts
  // All posts will be listed on the /blog route
};

const work: Work = {
  path: "/work",
  label: "Work",
  title: `Projects – ${person.name}`,
  description: `Design and dev projects by ${person.name}`,
  // Create new project pages by adding a new .mdx file to app/blog/posts
  // All projects will be listed on the /home and /work routes
};

const gallery: Gallery = {
  path: "/gallery",
  label: "Gallery",
  title: `Photo gallery – ${person.name}`,
  description: `A photo collection by ${person.name}`,
  // Images by https://lorant.one
  // These are placeholder images, replace with your own
  images: [
    {
      src: "/images/gallery/horizontal-1.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/vertical-4.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/horizontal-3.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/vertical-1.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/vertical-2.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/horizontal-2.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/horizontal-4.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/vertical-3.jpg",
      alt: "image",
      orientation: "vertical",
    },
  ],
};

export { person, social, newsletter, home, about, blog, work, gallery };
