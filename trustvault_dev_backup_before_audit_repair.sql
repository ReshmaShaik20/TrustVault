--
-- PostgreSQL database dump
--

\restrict l6rb2hdeDhNA2D4N2W9IxL499smapH4qf8qChgw3X1fEeaxxjLcpNFFKYFgfDkA

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_events (
    id integer NOT NULL,
    actor_id integer,
    document_id integer,
    action character varying(100) NOT NULL,
    outcome character varying(20) NOT NULL,
    details json NOT NULL,
    created_at timestamp with time zone NOT NULL,
    previous_hash character varying(64),
    event_hash character varying(64) NOT NULL
);


ALTER TABLE public.audit_events OWNER TO postgres;

--
-- Name: audit_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_events_id_seq OWNER TO postgres;

--
-- Name: audit_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_events_id_seq OWNED BY public.audit_events.id;


--
-- Name: document_grants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_grants (
    id integer NOT NULL,
    document_id integer NOT NULL,
    user_id integer NOT NULL,
    permission character varying(20) NOT NULL
);


ALTER TABLE public.document_grants OWNER TO postgres;

--
-- Name: document_grants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_grants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_grants_id_seq OWNER TO postgres;

--
-- Name: document_grants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_grants_id_seq OWNED BY public.document_grants.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    storage_key character varying(500) NOT NULL,
    owner_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_id_seq OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: audit_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_events ALTER COLUMN id SET DEFAULT nextval('public.audit_events_id_seq'::regclass);


--
-- Name: document_grants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_grants ALTER COLUMN id SET DEFAULT nextval('public.document_grants_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: audit_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_events (id, actor_id, document_id, action, outcome, details, created_at, previous_hash, event_hash) FROM stdin;
1	1	\N	audit_test	success	{"message": "Testing audit chain"}	2026-10-19 18:30:49.620389+05:30	\N	773601bcaa09f45cb0a03753f9a0edab8520edbe8b6b467481d8372ca1c8fb3c
3	1	2	document_upload	success	{"filename": "Cloud Computing.pdf", "category": "Personal"}	2026-10-19 18:42:17.30069+05:30	bc1e9bea868bf6f9489f7e13706a760ca9554821d54b920065918b135a88977e	3d49b2b114e8da7f289adcb2573246a2361599d420820b396b21a09106597087
4	1	3	document_upload	success	{"filename": "Cloud Computing.pdf", "category": "Personal"}	2026-10-19 18:42:24.306929+05:30	3d49b2b114e8da7f289adcb2573246a2361599d420820b396b21a09106597087	c082c77a3e4d821135ad2b11f9b79da2294e3ccd520bb916bb5f85a8aaed9b31
5	1	1	document_download	success	{"filename": "NPTEL Online Certification Courses.pdf"}	2026-10-19 18:52:21.647829+05:30	c082c77a3e4d821135ad2b11f9b79da2294e3ccd520bb916bb5f85a8aaed9b31	b72453ed6af46682efa2d1ba7bd7caef99166c86711edee6cc411d61ebaf26fe
6	4	2	document_download	denied	{"reason": "insufficient_permission"}	2026-10-19 18:55:37.380778+05:30	b72453ed6af46682efa2d1ba7bd7caef99166c86711edee6cc411d61ebaf26fe	767ef93be12abec8ee63eb4158a076c7153a3b44836ad08a811c90e33c9c1015
7	4	3	document_download	denied	{"reason": "insufficient_permission"}	2026-10-19 18:55:48.575254+05:30	767ef93be12abec8ee63eb4158a076c7153a3b44836ad08a811c90e33c9c1015	ffd134cd8e1e18e79aacf13f184f5f6cbc03b34ccd782ece67a83e96444040a6
8	4	2	document_download	denied	{"reason": "insufficient_permission"}	2026-10-19 18:56:00.510266+05:30	ffd134cd8e1e18e79aacf13f184f5f6cbc03b34ccd782ece67a83e96444040a6	1d32880aab02e15f20cdcedaa99a444a9d1b8db7ee7fdce833ece4a05ff3d586
9	1	1	document_share	success	{"recipient_username": "bob", "permission": "read"}	2026-10-19 19:03:18.053275+05:30	1d32880aab02e15f20cdcedaa99a444a9d1b8db7ee7fdce833ece4a05ff3d586	2f4dfdc767c64a78c451ab6012023f8344727235069af76840fc0ea96644ba54
10	1	1	permission_revoke	success	{"revoked_username": "bob", "revoked_user_id": 3}	2026-10-19 19:17:13.648958+05:30	2f4dfdc767c64a78c451ab6012023f8344727235069af76840fc0ea96644ba54	638947e1566489ad14b0c6026a366332a4d88a83f1562522d529b792656efee6
11	6	4	document_upload	success	{"filename": "Cloud Computing.pdf", "category": "General"}	2026-10-20 10:52:38.551099+05:30	638947e1566489ad14b0c6026a366332a4d88a83f1562522d529b792656efee6	bdd2aa55042eae45ecc9d6edd4161f4543aba0b511420114d15c297e1bea7820
12	6	4	document_share	success	{"recipient_username": "bob", "permission": "read"}	2026-10-20 11:11:05.273788+05:30	bdd2aa55042eae45ecc9d6edd4161f4543aba0b511420114d15c297e1bea7820	5739b2aecf74c1867889c48878c99bd2a44471286b7e7406a3c6a5ecb37935cf
13	6	4	permission_revoke	success	{"revoked_username": "bob", "revoked_user_id": 3}	2026-10-20 11:42:46.117993+05:30	5739b2aecf74c1867889c48878c99bd2a44471286b7e7406a3c6a5ecb37935cf	39007992e79ef7e2adf9135d32363168d7756c91616ab978c41defb20a9b2957
14	3	4	document_download	denied	{"reason": "insufficient_permission"}	2026-10-20 11:46:51.690789+05:30	39007992e79ef7e2adf9135d32363168d7756c91616ab978c41defb20a9b2957	5f3b45c7151f3279a0bc4653deb343b8add0d8416fa8f62d70f60b8594153c96
15	\N	\N	test_event_one	success	{"message": "first event"}	2026-10-20 21:04:43.163675+05:30	5f3b45c7151f3279a0bc4653deb343b8add0d8416fa8f62d70f60b8594153c96	05cea7df9c44bafabd40aa97e7d9c41cb1d470a2568c12919c13a669e3ad81f3
16	\N	\N	test_event_two	success	{"message": "second event"}	2026-10-20 21:04:43.163675+05:30	05cea7df9c44bafabd40aa97e7d9c41cb1d470a2568c12919c13a669e3ad81f3	41572bd0caeccce57e0a4b576c62ed429a898a8406b9811e0d9704dbcc1c06d7
17	\N	\N	test_tampering	success	{"message": "tampered"}	2026-10-20 21:04:43.319005+05:30	41572bd0caeccce57e0a4b576c62ed429a898a8406b9811e0d9704dbcc1c06d7	4bb8185f0057a8b587a6f5f32cb601c53135dffc2a1ad662e3e6290260c75a7b
18	\N	\N	test_chain_one	success	{"number": 1}	2026-10-20 21:04:43.454609+05:30	4bb8185f0057a8b587a6f5f32cb601c53135dffc2a1ad662e3e6290260c75a7b	552b42dee707ca225d8a28d7d713916206d61de03b09300f943d3dfea84012a8
19	\N	\N	test_chain_two	success	{"number": 2}	2026-10-20 21:04:43.454609+05:30	552b42dee707ca225d8a28d7d713916206d61de03b09300f943d3dfea84012a8	5e20aeb025e432f4b04454d089bfe5ab1d6cf8c157d6f2a6b892b1c10a4a3857
2	1	\N	audit_test	success	{"message": "Testing audit chain"}	2026-10-19 18:32:07.048003+05:30	0000000000000000000000000000000000000000000000000000000000000000	bc1e9bea868bf6f9489f7e13706a760ca9554821d54b920065918b135a88977e
20	\N	\N	test_event_one	success	{"message": "first event"}	2026-10-20 21:06:03.608951+05:30	5e20aeb025e432f4b04454d089bfe5ab1d6cf8c157d6f2a6b892b1c10a4a3857	df5c3c2ae875c9c2b157d91995e0c12894a807cab7205650ed69c5c935be1962
21	\N	\N	test_event_two	success	{"message": "second event"}	2026-10-20 21:06:03.608951+05:30	df5c3c2ae875c9c2b157d91995e0c12894a807cab7205650ed69c5c935be1962	2315b864d98fe6fe7fc33b89dfc7a9819d49188c44735dd0e8449f4225a0b876
22	7	5	document_upload	success	{"filename": "\\u0c2e\\u0c38\\u0c3e\\u0c32 \\u0c30\\u0c47\\u0c1f\\u0c4d\\u0c32 \\u0c35\\u0c3f\\u0c35\\u0c30\\u0c2e\\u0c41.pdf", "category": "General"}	2026-10-20 22:15:59.777308+05:30	2315b864d98fe6fe7fc33b89dfc7a9819d49188c44735dd0e8449f4225a0b876	06ecf2cb4c1a72fec398da3425212e7d71c3607d972b843616842bb4fd4b939f
23	7	5	document_share	success	{"recipient_username": "bob", "permission": "read"}	2026-10-20 22:16:26.37672+05:30	06ecf2cb4c1a72fec398da3425212e7d71c3607d972b843616842bb4fd4b939f	2c4b313a443dd4a8cc9b4a54ec3c976b4a64b7a6a760b1ea37da75da7058fef3
24	7	5	permission_revoke	success	{"revoked_username": "bob", "revoked_user_id": 3}	2026-10-20 22:16:43.520532+05:30	2c4b313a443dd4a8cc9b4a54ec3c976b4a64b7a6a760b1ea37da75da7058fef3	894a9a2b00e820e45f69c90ec58b2952fec74a825958ba0253c8df71c8905be6
\.


--
-- Data for Name: document_grants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_grants (id, document_id, user_id, permission) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, name, category, storage_key, owner_id, created_at) FROM stdin;
1	NPTEL Online Certification Courses.pdf	Personal	a4ac789a28084d1086b613e98291f16b	1	2026-10-19 17:35:51.476627+05:30
2	Cloud Computing.pdf	Personal	8f7ccaaef0f1405eb6a91cf08b0fb8d2	1	2026-10-19 18:42:17.288767+05:30
3	Cloud Computing.pdf	Personal	577afe27fa7d4c95a131d8487a9ca33b	1	2026-10-19 18:42:24.302272+05:30
4	Cloud Computing.pdf	General	19706f2abd394608bfb4af533b1ba8d4	6	2026-10-20 10:52:38.540346+05:30
5	మసాల రేట్ల వివరము.pdf	General	0f41b1ccdd244e3fb50efd9b18d2cbab	7	2026-10-20 22:15:59.768834+05:30
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, role, created_at) FROM stdin;
1	alice	$argon2id$v=19$m=65536,t=3,p=4$DPGYvy4bFuCpZeLPjDkivQ$QtmBMGIutajnDPzkk12jWLA129wXHRnCXBUnnmsHj4k	user	2026-10-19 16:57:58.660942+05:30
4	charlie	$argon2id$v=19$m=65536,t=3,p=4$MY8xcrEke1hBI+hKm9lMJQ$zWYSzVUgswUXTYt4rNLT6uqtpDYzpukoWnQqJ3dqJYA	user	2026-10-19 18:12:19.986542+05:30
5	admin	$argon2id$v=19$m=65536,t=3,p=4$rrY5GWY212szj3kvA8iosQ$KxHCMD3wVjMahZql5diVwIlKFFbhxryVItyy7w+1OzM	admin	2026-10-19 22:14:48.155335+05:30
6	reshma	$argon2id$v=19$m=65536,t=3,p=4$nU6ZFcBoT6cO7/SfXBwcQw$d67BXdnKsAa7HbSS9PzOXrLtfhB8fIH38/l/szH17/8	user	2026-10-20 10:42:15.43265+05:30
3	bob	$argon2id$v=19$m=65536,t=3,p=4$rsArWNBgjfj6wJFkCjIwSw$6VqwTe1IXtkHTqaKTMuXemodGhbavqlzYb1mJ7r22WM	admin	2026-10-19 17:49:54.885204+05:30
7	jakeer	$argon2id$v=19$m=65536,t=3,p=4$HtpJqooqMrFFUF67aystww$4kZddsddCm3Cfh6L6Cbc8e38rabO895TVqfHpK6osJo	user	2026-10-20 22:15:20.961779+05:30
\.


--
-- Name: audit_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_events_id_seq', 24, true);


--
-- Name: document_grants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.document_grants_id_seq', 4, true);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.documents_id_seq', 5, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- Name: audit_events audit_events_event_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_event_hash_key UNIQUE (event_hash);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: document_grants document_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_grants
    ADD CONSTRAINT document_grants_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: documents documents_storage_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_storage_key_key UNIQUE (storage_key);


--
-- Name: document_grants uq_document_grant_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_grants
    ADD CONSTRAINT uq_document_grant_user UNIQUE (document_id, user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_document_grants_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_document_grants_document_id ON public.document_grants USING btree (document_id);


--
-- Name: ix_document_grants_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_document_grants_user_id ON public.document_grants USING btree (user_id);


--
-- Name: ix_documents_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_documents_owner_id ON public.documents USING btree (owner_id);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: audit_events audit_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: document_grants document_grants_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_grants
    ADD CONSTRAINT document_grants_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_grants document_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_grants
    ADD CONSTRAINT document_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: documents documents_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict l6rb2hdeDhNA2D4N2W9IxL499smapH4qf8qChgw3X1fEeaxxjLcpNFFKYFgfDkA

